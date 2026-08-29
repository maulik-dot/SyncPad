package com.example.syncpad.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.request.ChangePasswordRequest;
import com.example.syncpad.dto.request.UpdateProfileRequest;
import com.example.syncpad.dto.response.UserResponse;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.InvalidPasswordException;
import com.example.syncpad.exception.UserNotFoundException;
import com.example.syncpad.repository.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserResponse getCurrentUserProfile(String userEmail) {
        User user = getUserByEmail(userEmail);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateProfile(String userEmail, UpdateProfileRequest request) {
        User user = getUserByEmail(userEmail);

        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }

        if (request.getProfilePictureUrl() != null) {
            String picUrl = request.getProfilePictureUrl().trim();
            user.setProfilePictureUrl(picUrl.isEmpty() ? null : picUrl);
        }

        User updated = userRepository.save(user);
        return UserResponse.from(updated);
    }

    @Transactional
    public void changePassword(String userEmail, ChangePasswordRequest request) {
        User user = getUserByEmail(userEmail);

        if (user.getProvider() != null && !"LOCAL".equalsIgnoreCase(user.getProvider())) {
            throw new InvalidPasswordException("Password change is not available for " + user.getProvider() + "-linked accounts");
        }

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new InvalidPasswordException("Current password does not match");
        }

        if (request.getOldPassword().equals(request.getNewPassword())) {
            throw new InvalidPasswordException("New password must be different from current password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public List<UserResponse> searchUsers(String query, int limit) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }

        int maxLimit = Math.max(1, Math.min(limit, 20));
        Pageable pageable = PageRequest.of(0, maxLimit);
        List<User> users = userRepository.searchUsers(query.trim(), pageable);

        return users.stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
    }
}
