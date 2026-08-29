package com.example.syncpad.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.dto.sso.SsoLoginRequest;
import com.example.syncpad.dto.sso.SsoProviderResponse;
import com.example.syncpad.entity.EnterpriseSsoConfig;
import com.example.syncpad.entity.RefreshToken;
import com.example.syncpad.entity.User;
import com.example.syncpad.repository.EnterpriseSsoConfigRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.security.JwtService;

@Service
public class SsoProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(SsoProvisioningService.class);

    private final UserRepository userRepository;
    private final EnterpriseSsoConfigRepository ssoConfigRepository;
    private final AuthService authService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public SsoProvisioningService(
            UserRepository userRepository,
            EnterpriseSsoConfigRepository ssoConfigRepository,
            AuthService authService,
            JwtService jwtService,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.ssoConfigRepository = ssoConfigRepository;
        this.authService = authService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    public List<SsoProviderResponse> getActiveProviders() {
        return ssoConfigRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public SsoProviderResponse discoverDomain(String emailOrDomain) {
        if (emailOrDomain == null || emailOrDomain.isBlank()) {
            throw new IllegalArgumentException("Domain or email must not be empty");
        }

        String domain = emailOrDomain.contains("@")
                ? emailOrDomain.substring(emailOrDomain.indexOf("@") + 1).trim()
                : emailOrDomain.trim();

        return ssoConfigRepository.findByDomainIgnoreCase(domain)
                .map(this::mapToResponse)
                .orElseGet(() -> new SsoProviderResponse(
                        domain,
                        "SAML_GENERIC",
                        "Corporate Single Sign-On (" + domain + ")",
                        "https://sso." + domain + "/saml/sso",
                        "https://sso." + domain,
                        true
                ));
    }

    @Transactional
    public AuthResponse processSsoLogin(SsoLoginRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        String domain = email.contains("@") ? email.substring(email.indexOf("@") + 1) : "enterprise.com";

        log.info("Processing Enterprise SSO authentication for user={}, provider={}", email, request.getProvider());

        Optional<User> existingUserOpt = userRepository.findByEmail(email);
        User user;

        if (existingUserOpt.isPresent()) {
            user = existingUserOpt.get();
            if (Boolean.FALSE.equals(user.getActive())) {
                log.warn("Rejected SSO login for deactivated corporate account: {}", email);
                throw new AccessDeniedException("Corporate account is deactivated. Contact your IT administrator.");
            }

            if (request.getName() != null && !request.getName().isBlank()) {
                user.setName(request.getName());
            }
            if (request.getDepartment() != null) {
                user.setDepartment(request.getDepartment());
            }
            if (user.getSsoDomain() == null) {
                user.setSsoDomain(domain);
            }
            user = userRepository.save(user);
        } else {
            // Just-In-Time (JIT) Provisioning
            log.info("JIT Provisioning new enterprise user: email={}, domain={}", email, domain);
            String displayName = (request.getName() != null && !request.getName().isBlank())
                    ? request.getName().trim()
                    : email.split("@")[0];

            user = new User(displayName, email, passwordEncoder.encode(UUID.randomUUID().toString()));
            user.setProvider("SSO_" + request.getProvider().toUpperCase());
            user.setProviderId(request.getSsoId() != null ? request.getSsoId() : email);
            user.setActive(true);
            user.setSsoDomain(domain);
            user.setDepartment(request.getDepartment());

            user = userRepository.save(user);
        }

        // Ensure default workspace exists
        authService.ensureDefaultWorkspace(user);

        // Generate dual JWT credentials
        String accessToken = jwtService.generateToken(user.getEmail());
        RefreshToken refreshToken = authService.createRefreshToken(user);

        return new AuthResponse(accessToken, refreshToken.getToken(), user.getId(), user.getName(), user.getEmail());
    }

    private SsoProviderResponse mapToResponse(EnterpriseSsoConfig config) {
        return new SsoProviderResponse(
                config.getDomain(),
                config.getProvider(),
                config.getDisplayName(),
                config.getSingleSignOnUrl(),
                config.getIssuerUrl(),
                config.getAutoProvision() != null ? config.getAutoProvision() : true
        );
    }
}
