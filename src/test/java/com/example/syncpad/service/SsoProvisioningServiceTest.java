package com.example.syncpad.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.dto.sso.SsoLoginRequest;
import com.example.syncpad.dto.sso.SsoProviderResponse;
import com.example.syncpad.entity.EnterpriseSsoConfig;
import com.example.syncpad.entity.RefreshToken;
import com.example.syncpad.entity.User;
import com.example.syncpad.repository.EnterpriseSsoConfigRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.security.JwtService;

@ExtendWith(MockitoExtension.class)
class SsoProvisioningServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EnterpriseSsoConfigRepository ssoConfigRepository;

    @Mock
    private AuthService authService;

    @Mock
    private JwtService jwtService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private SsoProvisioningService ssoProvisioningService;

    @BeforeEach
    void setUp() {
        ssoProvisioningService = new SsoProvisioningService(
                userRepository,
                ssoConfigRepository,
                authService,
                jwtService,
                passwordEncoder
        );
    }

    @Test
    void testDiscoverDomain_existingConfig() {
        EnterpriseSsoConfig config = new EnterpriseSsoConfig(
                "okta.com", "OKTA", "Okta Identity", "https://idp.okta.com", "client_1", "https://sso.okta.com"
        );
        when(ssoConfigRepository.findByDomainIgnoreCase("okta.com")).thenReturn(Optional.of(config));

        SsoProviderResponse response = ssoProvisioningService.discoverDomain("user@okta.com");

        assertNotNull(response);
        assertEquals("okta.com", response.getDomain());
        assertEquals("OKTA", response.getProvider());
        assertEquals("Okta Identity", response.getDisplayName());
    }

    @Test
    void testDiscoverDomain_fallbackGenericSaml() {
        when(ssoConfigRepository.findByDomainIgnoreCase("custom-corp.com")).thenReturn(Optional.empty());

        SsoProviderResponse response = ssoProvisioningService.discoverDomain("custom-corp.com");

        assertNotNull(response);
        assertEquals("custom-corp.com", response.getDomain());
        assertEquals("SAML_GENERIC", response.getProvider());
    }

    @Test
    void testProcessSsoLogin_jitProvisionNewUser() {
        SsoLoginRequest req = new SsoLoginRequest("OKTA", "alex@enterprise.com", "Alex Smith");
        req.setDepartment("Engineering");

        when(userRepository.findByEmail("alex@enterprise.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashedPass");

        User savedUser = new User("Alex Smith", "alex@enterprise.com", "hashedPass");
        savedUser.setId(42L);
        savedUser.setProvider("SSO_OKTA");
        savedUser.setActive(true);

        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken("alex@enterprise.com")).thenReturn("mock-jwt-access-token");
        when(authService.createRefreshToken(any(User.class))).thenReturn(new RefreshToken("mock-refresh-token", savedUser, null));

        AuthResponse auth = ssoProvisioningService.processSsoLogin(req);

        assertNotNull(auth);
        assertEquals("mock-jwt-access-token", auth.getToken());
        assertEquals("mock-refresh-token", auth.getRefreshToken());
        assertEquals("alex@enterprise.com", auth.getEmail());
        verify(authService).ensureDefaultWorkspace(savedUser);
    }

    @Test
    void testProcessSsoLogin_existingUserActive() {
        SsoLoginRequest req = new SsoLoginRequest("AZURE_AD", "sara@company.com", "Sara Connor");

        User existing = new User("Sara", "sara@company.com", "hashed");
        existing.setId(99L);
        existing.setActive(true);

        when(userRepository.findByEmail("sara@company.com")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenReturn(existing);
        when(jwtService.generateToken("sara@company.com")).thenReturn("sara-jwt");
        when(authService.createRefreshToken(any(User.class))).thenReturn(new RefreshToken("sara-refresh", existing, null));

        AuthResponse auth = ssoProvisioningService.processSsoLogin(req);

        assertNotNull(auth);
        assertEquals("sara-jwt", auth.getToken());
        assertEquals(99L, auth.getId());
    }

    @Test
    void testProcessSsoLogin_deactivatedUserThrows403() {
        SsoLoginRequest req = new SsoLoginRequest("OKTA", "ex-employee@company.com", "Former Staff");

        User deactivated = new User("Former", "ex-employee@company.com", "hashed");
        deactivated.setActive(false);

        when(userRepository.findByEmail("ex-employee@company.com")).thenReturn(Optional.of(deactivated));

        assertThrows(AccessDeniedException.class, () -> {
            ssoProvisioningService.processSsoLogin(req);
        });
    }
}
