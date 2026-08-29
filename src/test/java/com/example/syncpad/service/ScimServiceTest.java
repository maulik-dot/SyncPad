package com.example.syncpad.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.dto.scim.ScimListResponse;
import com.example.syncpad.dto.scim.ScimPatchRequest;
import com.example.syncpad.dto.scim.ScimUserDto;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.DuplicateEmailException;
import com.example.syncpad.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ScimServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthService authService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private ScimService scimService;

    @BeforeEach
    void setUp() {
        scimService = new ScimService(userRepository, authService, passwordEncoder);
    }

    @Test
    void testListUsers_unfiltered() {
        User u1 = new User("User One", "user1@enterprise.com", "pass");
        u1.setId(1L);
        when(userRepository.findAll(any(PageRequest.class))).thenReturn(new PageImpl<>(List.of(u1)));

        ScimListResponse<ScimUserDto> res = scimService.listUsers(null, 1, 20);

        assertNotNull(res);
        assertEquals(1, res.getTotalResults());
        assertEquals("user1@enterprise.com", res.getResources().get(0).getUserName());
    }

    @Test
    void testListUsers_filterByEmail() {
        User u = new User("Jane Doe", "jane@company.com", "pass");
        u.setId(2L);
        when(userRepository.findByEmail("jane@company.com")).thenReturn(Optional.of(u));

        ScimListResponse<ScimUserDto> res = scimService.listUsers("userName eq \"jane@company.com\"", 1, 20);

        assertNotNull(res);
        assertEquals(1, res.getTotalResults());
        assertEquals("jane@company.com", res.getResources().get(0).getUserName());
    }

    @Test
    void testCreateUser_success() {
        ScimUserDto dto = new ScimUserDto();
        dto.setUserName("david@enterprise.com");
        dto.setDisplayName("David Lee");
        dto.setDepartment("DevOps");

        when(userRepository.findByEmail("david@enterprise.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        User saved = new User("David Lee", "david@enterprise.com", "hashed");
        saved.setId(10L);
        saved.setActive(true);
        saved.setDepartment("DevOps");
        when(userRepository.save(any(User.class))).thenReturn(saved);

        ScimUserDto created = scimService.createUser(dto);

        assertNotNull(created);
        assertEquals("10", created.getId());
        assertEquals("david@enterprise.com", created.getUserName());
        assertTrue(created.getActive());
        verify(authService).ensureDefaultWorkspace(saved);
    }

    @Test
    void testCreateUser_duplicateThrowsException() {
        ScimUserDto dto = new ScimUserDto();
        dto.setUserName("existing@enterprise.com");

        when(userRepository.findByEmail("existing@enterprise.com")).thenReturn(Optional.of(new User()));

        assertThrows(DuplicateEmailException.class, () -> {
            scimService.createUser(dto);
        });
    }

    @Test
    void testPatchUser_deactivateEmployee() {
        User existing = new User("Mark", "mark@company.com", "pass");
        existing.setId(5L);
        existing.setActive(true);

        when(userRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenReturn(existing);

        ScimPatchRequest patch = new ScimPatchRequest();
        patch.setOperations(List.of(new ScimPatchRequest.Operation("replace", "active", false)));

        ScimUserDto result = scimService.patchUser(5L, patch);

        assertNotNull(result);
        assertFalse(result.getActive());
        assertFalse(existing.getActive());
    }

    @Test
    void testDeleteUser_softDeprovision() {
        User existing = new User("Mark", "mark@company.com", "pass");
        existing.setId(7L);
        existing.setActive(true);

        when(userRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenReturn(existing);

        scimService.deleteUser(7L);

        assertFalse(existing.getActive());
        verify(userRepository).save(existing);
    }
}
