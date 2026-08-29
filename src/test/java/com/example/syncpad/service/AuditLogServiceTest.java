package com.example.syncpad.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.example.syncpad.dto.response.AuditLogResponse;
import com.example.syncpad.entity.AuditLog;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.AuditLogRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;

    @Mock
    private DocumentPermissionRepository documentPermissionRepository;

    @InjectMocks
    private AuditLogService auditLogService;

    private User user;
    private Workspace workspace;
    private Document document;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        user = new User("Bob", "bob@example.com", "pass");
        user.setId(2L);

        workspace = new Workspace("Eng", "Engineering", "#000", "E", user);
        workspace.setId(20L);

        document = new Document("Doc 1", "Body", FileType.DOC, "Eng", null, user);
        document.setId(200L);
    }

    @Test
    void testLogCreation() {
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(i -> i.getArgument(0));

        AuditLog log = auditLogService.log(user, workspace, document, "DOCUMENT_EDITED", "Updated section 1");
        assertNotNull(log);
        assertEquals("DOCUMENT_EDITED", log.getAction());
        assertEquals("Updated section 1", log.getDetails());
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    void testGetWorkspaceLogsAllowed() {
        when(workspaceRepository.findById(20L)).thenReturn(Optional.of(workspace));
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));

        AuditLog logEntry = new AuditLog(user, workspace, document, "WORKSPACE_CREATED", "Initialized");
        Page<AuditLog> page = new PageImpl<>(List.of(logEntry));
        when(auditLogRepository.findByWorkspaceIdOrderByCreatedAtDesc(any(Long.class), any(Pageable.class))).thenReturn(page);

        Page<AuditLogResponse> response = auditLogService.getWorkspaceActivity(20L, "bob@example.com", 0, 10);
        assertNotNull(response);
        assertEquals(1, response.getContent().size());
        assertEquals("WORKSPACE_CREATED", response.getContent().get(0).getAction());
    }

    @Test
    void testGetWorkspaceLogsForbiddenForNonMember() {
        User otherUser = new User("Stranger", "stranger@example.com", "pass");
        otherUser.setId(99L);

        when(workspaceRepository.findById(20L)).thenReturn(Optional.of(workspace));
        when(userRepository.findByEmail("stranger@example.com")).thenReturn(Optional.of(otherUser));
        when(workspacePermissionRepository.findByUserAndWorkspace(otherUser, workspace)).thenReturn(Optional.empty());

        assertThrows(PermissionDeniedException.class, () ->
                auditLogService.getWorkspaceActivity(20L, "stranger@example.com", 0, 10)
        );
    }
}
