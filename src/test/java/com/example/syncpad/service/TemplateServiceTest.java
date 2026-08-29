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
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.syncpad.dto.request.CreateTemplateRequest;
import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.dto.response.TemplateResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentTemplate;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.TemplateRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@ExtendWith(MockitoExtension.class)
public class TemplateServiceTest {

    @Mock
    private TemplateRepository templateRepository;
    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private WorkspaceRepository workspaceRepository;
    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private DocumentService documentService;
    @Mock
    private AuditLogService auditLogService;

    private TemplateService templateService;

    private User user;
    private Workspace workspace;
    private DocumentTemplate builtinTemplate;

    @BeforeEach
    public void setup() {
        templateService = new TemplateService(
                templateRepository,
                documentRepository,
                workspaceRepository,
                workspacePermissionRepository,
                userRepository,
                documentService,
                auditLogService
        );

        user = new User("Alice", "alice@example.com", "hash");
        user.setId(1L);

        workspace = new Workspace("Eng Team", "Engineering Workspace", "#4F46E5", "E", user);
        workspace.setId(10L);

        builtinTemplate = new DocumentTemplate(
                "Meeting Notes",
                "Standard agenda",
                "# Meeting Notes",
                "Meetings",
                "calendar",
                true,
                null,
                null
        );
        builtinTemplate.setId(100L);
    }

    @Test
    public void testGetTemplates_BuiltInAndWorkspace() {
        when(templateRepository.findByIsBuiltinTrueOrderByTitleAsc())
                .thenReturn(List.of(builtinTemplate));
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(user));
        when(workspaceRepository.findById(10L))
                .thenReturn(Optional.of(workspace));

        DocumentTemplate customTemplate = new DocumentTemplate(
                "Custom Spec", "Spec template", "# Spec", "Engineering", "cpu", false, workspace, user
        );
        customTemplate.setId(101L);

        when(templateRepository.findByWorkspaceIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(customTemplate));

        List<TemplateResponse> templates = templateService.getTemplates(10L, "alice@example.com");
        assertEquals(2, templates.size());
        assertEquals("Meeting Notes", templates.get(0).getTitle());
        assertTrue(templates.get(0).isBuiltin());
        assertEquals("Custom Spec", templates.get(1).getTitle());
        assertFalse(templates.get(1).isBuiltin());
    }

    @Test
    public void testCreateTemplate_Success() {
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(user));
        when(workspaceRepository.findById(10L))
                .thenReturn(Optional.of(workspace));

        CreateTemplateRequest req = new CreateTemplateRequest();
        req.setTitle("Sprint Retro Blueprint");
        req.setDescription("Retrospective outline");
        req.setContent("# Sprint Retro");
        req.setCategory("Engineering");
        req.setWorkspaceId(10L);

        when(templateRepository.save(any(DocumentTemplate.class)))
                .thenAnswer(inv -> {
                    DocumentTemplate t = inv.getArgument(0);
                    t.setId(200L);
                    return t;
                });

        TemplateResponse res = templateService.createTemplate(req, "alice@example.com");
        assertNotNull(res);
        assertEquals(200L, res.getId());
        assertEquals("Sprint Retro Blueprint", res.getTitle());
        verify(auditLogService).log(eq(user), eq(workspace), any(), eq("TEMPLATE_CREATED"), anyString());
    }

    @Test
    public void testCreateTemplate_NonAdmin_ThrowsForbidden() {
        User outsider = new User("Bob", "bob@example.com", "hash");
        outsider.setId(2L);

        when(userRepository.findByEmail("bob@example.com"))
                .thenReturn(Optional.of(outsider));
        when(workspaceRepository.findById(10L))
                .thenReturn(Optional.of(workspace));
        when(workspacePermissionRepository.findByUserAndWorkspace(outsider, workspace))
                .thenReturn(Optional.of(new WorkspacePermission(workspace, outsider, Role.VIEWER)));

        CreateTemplateRequest req = new CreateTemplateRequest();
        req.setTitle("Hacked Blueprint");
        req.setContent("Content");
        req.setWorkspaceId(10L);

        assertThrows(PermissionDeniedException.class, () ->
                templateService.createTemplate(req, "bob@example.com"));
    }

    @Test
    public void testInstantiateTemplate_Success() {
        when(userRepository.findByEmail("alice@example.com"))
                .thenReturn(Optional.of(user));
        when(templateRepository.findById(100L))
                .thenReturn(Optional.of(builtinTemplate));
        when(workspaceRepository.findById(10L))
                .thenReturn(Optional.of(workspace));

        Document newDoc = new Document("Meeting Notes", "# Meeting Notes", com.example.syncpad.entity.FileType.DOC, "Eng Team", null, user);
        newDoc.setId(500L);

        when(documentService.createDocument(eq("Weekly Team Sync"), eq("# Meeting Notes"), eq("DOC"), eq(null), eq("Eng Team"), eq("alice@example.com")))
                .thenReturn(newDoc);

        DocumentResponse res = templateService.instantiateTemplate(100L, 10L, "Weekly Team Sync", "alice@example.com");
        assertNotNull(res);
        assertEquals(500L, res.getId());
    }
}
