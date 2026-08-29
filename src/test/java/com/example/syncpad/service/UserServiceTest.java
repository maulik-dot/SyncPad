package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.dto.request.ChangePasswordRequest;
import com.example.syncpad.dto.request.UpdateProfileRequest;
import com.example.syncpad.dto.response.UserResponse;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.InvalidPasswordException;
import com.example.syncpad.exception.UserNotFoundException;
import com.example.syncpad.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User("Alice Smith", "alice@example.com", "encodedPassword123");
        testUser.setId(1L);
        testUser.setProvider("LOCAL");
        testUser.setProfilePictureUrl("https://example.com/avatar.png");
        testUser.setCreatedAt(LocalDateTime.now().minusDays(2));
    }

    @Test
    void getCurrentUserProfile_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));

        UserResponse response = userService.getCurrentUserProfile("alice@example.com");

        assertNotNull(response);
        assertEquals(1L, response.getId());
        assertEquals("Alice Smith", response.getName());
        assertEquals("alice@example.com", response.getEmail());
        assertEquals("https://example.com/avatar.png", response.getProfilePictureUrl());
        assertEquals("LOCAL", response.getProvider());
        assertNotNull(response.getCreatedAt());
    }

    @Test
    void getCurrentUserProfile_NotFound_ThrowsException() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> {
            userService.getCurrentUserProfile("unknown@example.com");
        });
    }

    @Test
    void updateProfile_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest("Alice Johnson", "https://example.com/new-avatar.png");
        UserResponse response = userService.updateProfile("alice@example.com", request);

        assertNotNull(response);
        assertEquals("Alice Johnson", response.getName());
        assertEquals("https://example.com/new-avatar.png", response.getProfilePictureUrl());
        verify(userRepository).save(testUser);
    }

    @Test
    void changePassword_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("OldPassword123!", "encodedPassword123")).thenReturn(true);
        when(passwordEncoder.encode("NewPassword456!")).thenReturn("newEncodedPassword456");

        ChangePasswordRequest request = new ChangePasswordRequest("OldPassword123!", "NewPassword456!");
        userService.changePassword("alice@example.com", request);

        assertEquals("newEncodedPassword456", testUser.getPassword());
        verify(userRepository).save(testUser);
    }

    @Test
    void changePassword_WrongCurrentPassword_ThrowsException() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("WrongPassword!", "encodedPassword123")).thenReturn(false);

        ChangePasswordRequest request = new ChangePasswordRequest("WrongPassword!", "NewPassword456!");
        assertThrows(InvalidPasswordException.class, () -> {
            userService.changePassword("alice@example.com", request);
        });
    }

    @Test
    void changePassword_SamePassword_ThrowsException() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("OldPassword123!", "encodedPassword123")).thenReturn(true);

        ChangePasswordRequest request = new ChangePasswordRequest("OldPassword123!", "OldPassword123!");
        assertThrows(InvalidPasswordException.class, () -> {
            userService.changePassword("alice@example.com", request);
        });
    }

    @Test
    void changePassword_OAuthAccount_ThrowsException() {
        testUser.setProvider("GOOGLE");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(testUser));

        ChangePasswordRequest request = new ChangePasswordRequest("OldPassword123!", "NewPassword456!");
        assertThrows(InvalidPasswordException.class, () -> {
            userService.changePassword("alice@example.com", request);
        });
    }

    @Test
    void searchUsers_ReturnsMatchingUsers() {
        User bob = new User("Bob Smith", "bob@example.com", "pass");
        bob.setId(2L);

        when(userRepository.searchUsers(eq("Smith"), any(Pageable.class)))
                .thenReturn(List.of(testUser, bob));

        List<UserResponse> results = userService.searchUsers("Smith", 10);

        assertEquals(2, results.size());
        assertEquals("Alice Smith", results.get(0).getName());
        assertEquals("Bob Smith", results.get(1).getName());
    }

    @Test
    void searchUsers_QueryTooShort_ReturnsEmptyList() {
        List<UserResponse> results1 = userService.searchUsers("a", 10);
        List<UserResponse> results2 = userService.searchUsers("", 10);
        List<UserResponse> results3 = userService.searchUsers(null, 10);

        assertTrue(results1.isEmpty());
        assertTrue(results2.isEmpty());
        assertTrue(results3.isEmpty());
    }
}
