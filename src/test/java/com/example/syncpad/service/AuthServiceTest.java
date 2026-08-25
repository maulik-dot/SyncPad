package com.example.syncpad.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.dto.request.LoginRequest;
import com.example.syncpad.dto.request.RegisterRequest;
import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.DuplicateEmailException;
import com.example.syncpad.exception.InvalidTokenException;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.example.syncpad.security.JwtService;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;

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

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtService.generateToken(savedUser.getEmail())).thenReturn("mock-jwt-token");

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
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

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches(request.getPassword(), existingUser.getPassword())).thenReturn(true);
        when(jwtService.generateToken(existingUser.getEmail())).thenReturn("mock-jwt-token");

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
    }

    @Test
    public void testLogin_InvalidCredentials() {
        LoginRequest request = new LoginRequest("test@example.com", "WrongPassword");
        User existingUser = new User("Test User", "test@example.com", "encodedPassword");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches(request.getPassword(), existingUser.getPassword())).thenReturn(false);

        assertThrows(InvalidTokenException.class, () -> authService.login(request));
    }
}
