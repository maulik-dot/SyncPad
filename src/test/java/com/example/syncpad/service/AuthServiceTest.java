package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.dto.request.LoginRequest;
import com.example.syncpad.dto.request.RegisterRequest;
import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.entity.RefreshToken;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.DuplicateEmailException;
import com.example.syncpad.exception.InvalidTokenException;
import com.example.syncpad.repository.RefreshTokenRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.example.syncpad.security.JwtService;
import com.example.syncpad.security.TokenBlacklistService;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    public void testRegister_Success() {
        RegisterRequest request = new RegisterRequest("Test User", "test@example.com", "Password123!");
        User savedUser = new User("Test User", "test@example.com", "encodedPassword");
        savedUser.setId(1L);

        RefreshToken savedRt = new RefreshToken("sample-refresh-token", savedUser, LocalDateTime.now().plusDays(7));

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken(savedUser.getEmail())).thenReturn("mock-jwt-token");
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(savedRt);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
        assertEquals("sample-refresh-token", response.getRefreshToken());
        assertEquals("test@example.com", response.getEmail());
    }

    @Test
    public void testRegister_DuplicateEmail() {
        RegisterRequest request = new RegisterRequest("Test User", "test@example.com", "Password123!");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(new User()));

        assertThrows(DuplicateEmailException.class, () -> authService.register(request));
    }

    @Test
    public void testLogin_Success() {
        LoginRequest request = new LoginRequest("test@example.com", "Password123!");
        User existingUser = new User("Test User", "test@example.com", "encodedPassword");
        existingUser.setId(1L);

        RefreshToken savedRt = new RefreshToken("sample-refresh-token", existingUser, LocalDateTime.now().plusDays(7));

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches(request.getPassword(), existingUser.getPassword())).thenReturn(true);
        when(jwtService.generateToken(existingUser.getEmail())).thenReturn("mock-jwt-token");
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(savedRt);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
        assertEquals("sample-refresh-token", response.getRefreshToken());
    }

    @Test
    public void testLogin_InvalidCredentials() {
        LoginRequest request = new LoginRequest("test@example.com", "WrongPassword");
        User existingUser = new User("Test User", "test@example.com", "encodedPassword");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches(request.getPassword(), existingUser.getPassword())).thenReturn(false);

        assertThrows(InvalidTokenException.class, () -> authService.login(request));
    }

    @Test
    public void testRefreshToken_Success() {
        User user = new User("Alice", "alice@example.com", "pass");
        user.setId(2L);
        RefreshToken activeRt = new RefreshToken("old-refresh-token", user, LocalDateTime.now().plusDays(5));
        RefreshToken newRt = new RefreshToken("new-refresh-token", user, LocalDateTime.now().plusDays(7));

        when(refreshTokenRepository.findByToken("old-refresh-token")).thenReturn(Optional.of(activeRt));
        when(jwtService.generateToken(user.getEmail())).thenReturn("new-access-token");
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenReturn(newRt);

        AuthResponse response = authService.refreshToken("old-refresh-token");

        assertNotNull(response);
        assertEquals("new-access-token", response.getToken());
        assertEquals("new-refresh-token", response.getRefreshToken());
    }

    @Test
    public void testRefreshToken_Expired() {
        User user = new User("Alice", "alice@example.com", "pass");
        RefreshToken expiredRt = new RefreshToken("expired-token", user, LocalDateTime.now().minusDays(1));

        when(refreshTokenRepository.findByToken("expired-token")).thenReturn(Optional.of(expiredRt));

        assertThrows(InvalidTokenException.class, () -> authService.refreshToken("expired-token"));
    }

    @Test
    public void testLogout_Success() {
        User user = new User("Alice", "alice@example.com", "pass");
        RefreshToken rt = new RefreshToken("token-to-logout", user, LocalDateTime.now().plusDays(2));

        when(refreshTokenRepository.findByToken("token-to-logout")).thenReturn(Optional.of(rt));

        authService.logout("token-to-logout", "Bearer mock-access-token");

        verify(refreshTokenRepository).save(rt);
        verify(tokenBlacklistService).blacklistToken(any(), any(Long.class));
    }
}
