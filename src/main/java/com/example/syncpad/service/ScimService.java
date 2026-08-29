package com.example.syncpad.service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.scim.ScimListResponse;
import com.example.syncpad.dto.scim.ScimPatchRequest;
import com.example.syncpad.dto.scim.ScimUserDto;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.DuplicateEmailException;
import com.example.syncpad.exception.UserNotFoundException;
import com.example.syncpad.repository.UserRepository;

@Service
public class ScimService {

    private static final Logger log = LoggerFactory.getLogger(ScimService.class);

    private final UserRepository userRepository;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;

    public ScimService(UserRepository userRepository, AuthService authService, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.authService = authService;
        this.passwordEncoder = passwordEncoder;
    }

    public ScimListResponse<ScimUserDto> listUsers(String filter, int startIndex, int count) {
        int pageIndex = Math.max(0, (startIndex - 1) / Math.max(1, count));
        int pageSize = Math.max(1, Math.min(count, 100));

        if (filter != null && !filter.isBlank()) {
            String extractedEmail = extractEmailFromFilter(filter);
            if (extractedEmail != null) {
                return userRepository.findByEmail(extractedEmail)
                        .map(u -> new ScimListResponse<>(1, 1, 1, List.of(mapToScim(u))))
                        .orElseGet(() -> new ScimListResponse<>(0, 1, 0, Collections.emptyList()));
            }
        }

        Page<User> page = userRepository.findAll(PageRequest.of(pageIndex, pageSize));
        List<ScimUserDto> resources = page.getContent().stream()
                .map(this::mapToScim)
                .collect(Collectors.toList());

        return new ScimListResponse<>(page.getTotalElements(), startIndex, resources.size(), resources);
    }

    public ScimUserDto getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("SCIM User not found for id: " + id));
        return mapToScim(user);
    }

    @Transactional
    public ScimUserDto createUser(ScimUserDto dto) {
        String email = dto.getUserName();
        if (email == null && dto.getEmails() != null && !dto.getEmails().isEmpty()) {
            email = dto.getEmails().get(0).getValue();
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("userName or email is required for SCIM user creation");
        }

        email = email.trim().toLowerCase();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new DuplicateEmailException("User already exists with email: " + email);
        }

        String displayName = dto.getDisplayName();
        if (displayName == null && dto.getName() != null) {
            displayName = dto.getName().getFormatted();
            if (displayName == null && dto.getName().getGivenName() != null) {
                displayName = dto.getName().getGivenName() + (dto.getName().getFamilyName() != null ? " " + dto.getName().getFamilyName() : "");
            }
        }
        if (displayName == null || displayName.isBlank()) {
            displayName = email.split("@")[0];
        }

        String domain = email.contains("@") ? email.substring(email.indexOf("@") + 1) : "enterprise.com";

        User user = new User(displayName, email, passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setProvider("SCIM");
        user.setProviderId(email);
        user.setActive(dto.getActive() != null ? dto.getActive() : true);
        user.setSsoDomain(domain);
        user.setDepartment(dto.getDepartment());

        User savedUser = userRepository.save(user);
        authService.ensureDefaultWorkspace(savedUser);

        log.info("Provisioned user via SCIM 2.0: id={}, email={}", savedUser.getId(), savedUser.getEmail());
        return mapToScim(savedUser);
    }

    @Transactional
    public ScimUserDto updateUser(Long id, ScimUserDto dto) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + id));

        if (dto.getDisplayName() != null && !dto.getDisplayName().isBlank()) {
            user.setName(dto.getDisplayName());
        }
        if (dto.getActive() != null) {
            user.setActive(dto.getActive());
        }
        if (dto.getDepartment() != null) {
            user.setDepartment(dto.getDepartment());
        }

        User saved = userRepository.save(user);
        return mapToScim(saved);
    }

    @Transactional
    public ScimUserDto patchUser(Long id, ScimPatchRequest patchRequest) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + id));

        if (patchRequest.getOperations() != null) {
            for (ScimPatchRequest.Operation op : patchRequest.getOperations()) {
                String path = op.getPath();
                Object value = op.getValue();

                if ("active".equalsIgnoreCase(path)) {
                    if (value instanceof Boolean) {
                        user.setActive((Boolean) value);
                    } else if (value instanceof String) {
                        user.setActive(Boolean.parseBoolean((String) value));
                    }
                } else if (value instanceof Map) {
                    Map<?, ?> map = (Map<?, ?>) value;
                    if (map.containsKey("active")) {
                        Object activeVal = map.get("active");
                        if (activeVal instanceof Boolean) {
                            user.setActive((Boolean) activeVal);
                        } else if (activeVal instanceof String) {
                            user.setActive(Boolean.parseBoolean((String) activeVal));
                        }
                    }
                    if (map.containsKey("displayName")) {
                        user.setName(String.valueOf(map.get("displayName")));
                    }
                } else if ("displayName".equalsIgnoreCase(path) && value != null) {
                    user.setName(String.valueOf(value));
                }
            }
        }

        User saved = userRepository.save(user);
        log.info("Patched user via SCIM 2.0: id={}, active={}", saved.getId(), saved.getActive());
        return mapToScim(saved);
    }

    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
        user.setActive(false);
        userRepository.save(user);
        log.info("Deactivated user via SCIM 2.0: id={}", id);
    }

    private ScimUserDto mapToScim(User user) {
        ScimUserDto dto = new ScimUserDto();
        dto.setId(String.valueOf(user.getId()));
        dto.setUserName(user.getEmail());
        dto.setDisplayName(user.getName());
        dto.setActive(user.getActive() != null ? user.getActive() : true);
        dto.setDepartment(user.getDepartment());
        dto.setName(new ScimUserDto.Name(user.getName(), null, user.getName()));
        dto.setEmails(List.of(new ScimUserDto.Email(user.getEmail())));
        dto.setMeta(Map.of(
                "resourceType", "User",
                "created", user.getCreatedAt() != null ? user.getCreatedAt().toString() : "",
                "location", "/scim/v2/Users/" + user.getId()
        ));
        return dto;
    }

    private String extractEmailFromFilter(String filter) {
        if (filter.contains("eq")) {
            int eqIndex = filter.indexOf("eq");
            String right = filter.substring(eqIndex + 2).trim();
            return right.replace("\"", "").replace("'", "").trim();
        }
        return null;
    }
}
