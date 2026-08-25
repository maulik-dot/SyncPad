package com.example.syncpad.service;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.FolderPermissionRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@SpringBootTest
@Transactional
public class WorkspaceCollaborationAccessTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private WorkspacePermissionRepository workspacePermissionRepository;

    @Autowired
    private WorkspaceService workspaceService;

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private FolderPermissionRepository folderPermissionRepository;

    @Autowired
    private FolderService folderService;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentPermissionRepository documentPermissionRepository;

    @Autowired
    private DocumentService documentService;

    private User alice; // Admin / Owner
    private User bob;   // Collaborator / Member
    private Workspace workspace;
    private Folder generalFolder;
    private Folder secretFolder;
    private Document rootDoc;
    private Document folderDoc;

    @BeforeEach
    public void setup() {
        alice = userRepository.save(new User("Alice", "alice_test@syncpad.com", "pass123"));
        bob = userRepository.save(new User("Bob", "bob_test@syncpad.com", "pass123"));

        workspace = workspaceService.createWorkspace("Engineering WS", "Core engineering workspace", "#6366f1", alice.getEmail());

        generalFolder = folderService.createFolder("General Specs", "Engineering WS", null, alice.getEmail());
        secretFolder = folderService.createFolder("Secret Research", "Engineering WS", null, alice.getEmail());

        rootDoc = documentService.createDocument("Architecture Overview", "System overview content", "DOC", null, "Engineering WS", alice.getEmail());
        folderDoc = documentService.createDocument("Secret Algorithm", "Proprietary code details", "DOC", secretFolder.getId(), "Engineering WS", alice.getEmail());
    }

    @Test
    public void testCollaboratorInheritsAccessToAllWorkspaceFilesAndFolders() {
        // Alice invites Bob as an EDITOR to the workspace
        workspaceService.shareWorkspace(workspace.getId(), alice.getEmail(), bob.getEmail(), Role.EDITOR);

        // 1. Bob can see all folders in the workspace
        List<Folder> bobFolders = folderService.getFoldersByWorkspace("Engineering WS", bob.getEmail());
        assertEquals(2, bobFolders.size());
        assertTrue(bobFolders.stream().anyMatch(f -> f.getName().equals("General Specs")));
        assertTrue(bobFolders.stream().anyMatch(f -> f.getName().equals("Secret Research")));

        // 2. Bob can see all documents in the workspace
        List<Document> bobDocs = documentService.getAccessibleDocuments(bob.getEmail());
        assertEquals(2, bobDocs.size());

        // 3. Bob can edit rootDoc as an inherited EDITOR
        Document updatedDoc = documentService.updateDocument(rootDoc.getId(), "Architecture Overview v2", "Updated by Bob", bob.getEmail());
        assertEquals("Updated by Bob", updatedDoc.getContent());
    }

    @Test
    public void testAdminCanRestrictCollaboratorOnSpecificDocument() {
        // Bob joins workspace as EDITOR
        workspaceService.shareWorkspace(workspace.getId(), alice.getEmail(), bob.getEmail(), Role.EDITOR);

        // Alice restricts Bob on rootDoc
        documentService.updateDocumentPermission(rootDoc.getId(), bob.getId(), bob.getEmail(), Role.RESTRICTED, alice.getEmail());

        // Bob should NO LONGER see rootDoc in accessible documents
        List<Document> bobDocs = documentService.getAccessibleDocuments(bob.getEmail());
        assertEquals(1, bobDocs.size());
        assertFalse(bobDocs.stream().anyMatch(d -> d.getId().equals(rootDoc.getId())));

        // Bob trying to read rootDoc directly gets PermissionDeniedException
        assertThrows(PermissionDeniedException.class, () -> {
            documentService.getDocument(rootDoc.getId(), bob.getEmail());
        });

        // Bob trying to update rootDoc gets PermissionDeniedException
        assertThrows(PermissionDeniedException.class, () -> {
            documentService.updateDocument(rootDoc.getId(), "Hacked", "Denied", bob.getEmail());
        });

        // Alice lifts restriction (sets role back to null / default)
        documentService.updateDocumentPermission(rootDoc.getId(), bob.getId(), bob.getEmail(), null, alice.getEmail());

        // Bob can now access rootDoc again
        Document restoredDoc = documentService.getDocument(rootDoc.getId(), bob.getEmail());
        assertNotNull(restoredDoc);
    }

    @Test
    public void testAdminCanRestrictCollaboratorOnFolderAndItsFiles() {
        // Bob joins workspace as EDITOR
        workspaceService.shareWorkspace(workspace.getId(), alice.getEmail(), bob.getEmail(), Role.EDITOR);

        // Alice restricts Bob on secretFolder
        folderService.updateFolderPermission(secretFolder.getId(), bob.getId(), bob.getEmail(), Role.RESTRICTED, alice.getEmail());

        // 1. Bob's folder list should only contain generalFolder, NOT secretFolder
        List<Folder> bobFolders = folderService.getFoldersByWorkspace("Engineering WS", bob.getEmail());
        assertEquals(1, bobFolders.size());
        assertEquals("General Specs", bobFolders.get(0).getName());

        // 2. Direct folder access denied
        assertThrows(PermissionDeniedException.class, () -> {
            folderService.getFolder(secretFolder.getId(), bob.getEmail());
        });

        // 3. Documents inside secretFolder should also be hidden and restricted for Bob
        List<Document> bobDocs = documentService.getAccessibleDocuments(bob.getEmail());
        assertEquals(1, bobDocs.size());
        assertEquals("Architecture Overview", bobDocs.get(0).getTitle());

        assertThrows(PermissionDeniedException.class, () -> {
            documentService.getDocument(folderDoc.getId(), bob.getEmail());
        });

        // 4. Alice removes restriction
        folderService.removeFolderPermission(secretFolder.getId(), bob.getId(), alice.getEmail());

        // Bob can see secretFolder and folderDoc again
        List<Folder> restoredFolders = folderService.getFoldersByWorkspace("Engineering WS", bob.getEmail());
        assertEquals(2, restoredFolders.size());
    }

    @Test
    public void testAdminCanRestrictCollaboratorToReadOnlyViewOnly() {
        // Bob joins workspace as EDITOR
        workspaceService.shareWorkspace(workspace.getId(), alice.getEmail(), bob.getEmail(), Role.EDITOR);

        // Alice restricts Bob on rootDoc to VIEWER
        documentService.updateDocumentPermission(rootDoc.getId(), bob.getId(), bob.getEmail(), Role.VIEWER, alice.getEmail());

        // Bob can still read rootDoc
        Document doc = documentService.getDocument(rootDoc.getId(), bob.getEmail());
        assertNotNull(doc);

        // But Bob cannot edit rootDoc
        assertThrows(PermissionDeniedException.class, () -> {
            documentService.updateDocument(rootDoc.getId(), "Title", "Content", bob.getEmail());
        });
    }
}
