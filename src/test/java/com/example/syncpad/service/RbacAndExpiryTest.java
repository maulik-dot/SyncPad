package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentPermission;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.DocumentVersionRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.ShareLinkRepository;
import com.example.syncpad.repository.TagRepository;
import com.example.syncpad.repository.UserFavoriteRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@ExtendWith(MockitoExtension.class)
public class RbacAndExpiryTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private DocumentPermissionRepository permissionRepository;
    @Mock private DocumentVersionRepository versionRepository;
    @Mock private ShareLinkRepository shareLinkRepository;
    @Mock private FolderRepository folderRepository;
    @Mock private DocumentCommentRepository commentRepository;
    @Mock private FolderService folderService;
    @Mock private WorkspaceRepository workspaceRepository;
    @Mock private WorkspacePermissionRepository workspacePermissionRepository;
    @Mock private TagRepository tagRepository;
    @Mock private UserFavoriteRepository userFavoriteRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private WebhookService webhookService;

    private DocumentService documentService;

    private User owner;
    private User collaborator;
    private Document doc;

    @BeforeEach
    public void setup() {
        documentService = new DocumentService(
                documentRepository,
                userRepository,
                permissionRepository,
                versionRepository,
                shareLinkRepository,
                folderRepository,
                commentRepository,
                folderService,
                workspaceRepository,
                workspacePermissionRepository,
                tagRepository,
                userFavoriteRepository,
                null,
                null,
                null,
                auditLogService,
                webhookService
        );

        owner = new User("Owner", "owner@example.com", "hash");
        owner.setId(1L);

        collaborator = new User("Collaborator", "collab@example.com", "hash");
        collaborator.setId(2L);

        doc = new Document("Specs", "Content", FileType.DOC, null, null, owner);
        doc.setId(10L);
    }

    @Test
    public void testCommenterRole_CanViewRole_CannotEditContent() {
        DocumentPermission perm = new DocumentPermission(collaborator, doc, Role.COMMENTER);
        when(permissionRepository.findByUserAndDocument(collaborator, doc)).thenReturn(Optional.of(perm));
        when(userRepository.findByEmail("collab@example.com")).thenReturn(Optional.of(collaborator));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));

        Role role = documentService.getEffectiveRole(doc, collaborator);
        assertEquals(Role.COMMENTER, role);

        // Cannot edit
        assertThrows(PermissionDeniedException.class, () ->
                documentService.assertCanEditDocument(10L, "collab@example.com"));

        // Cannot rename
        assertThrows(PermissionDeniedException.class, () ->
                documentService.renameDocument(10L, "Renamed by Commenter", "collab@example.com"));
    }

    @Test
    public void testExpiredGuestPermission_IsTreatedAsRevoked() {
        // Expired 1 hour ago
        LocalDateTime past = LocalDateTime.now().minusHours(1);
        DocumentPermission expiredPerm = new DocumentPermission(collaborator, doc, Role.EDITOR, past);

        when(permissionRepository.findByUserAndDocument(collaborator, doc)).thenReturn(Optional.of(expiredPerm));

        Role role = documentService.getEffectiveRole(doc, collaborator);
        assertNull(role);
    }

    @Test
    public void testValidGuestPermission_ActiveWithinTimeWindow() {
        // Expires in 24 hours
        LocalDateTime future = LocalDateTime.now().plusHours(24);
        DocumentPermission activePerm = new DocumentPermission(collaborator, doc, Role.EDITOR, future);

        when(permissionRepository.findByUserAndDocument(collaborator, doc)).thenReturn(Optional.of(activePerm));

        Role role = documentService.getEffectiveRole(doc, collaborator);
        assertNotNull(role);
        assertEquals(Role.EDITOR, role);
    }
}
