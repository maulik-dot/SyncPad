package com.example.syncpad.service;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@SpringBootTest
@Transactional
public class WorkspaceFolderFileLifecycleTest {

    @Autowired private WorkspaceService workspaceService;
    @Autowired private FolderService folderService;
    @Autowired private DocumentService documentService;

    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private FolderRepository folderRepository;
    @Autowired private DocumentRepository documentRepository;

    private User owner;

    @BeforeEach
    public void setup() {
        owner = userRepository.findByEmail("alice_lifecycle@example.com").orElseGet(() -> {
            User u = new User("Alice Lifecycle", "alice_lifecycle@example.com", "hash");
            return userRepository.save(u);
        });
    }

    @Test
    public void testWorkspaceCreation_RenameCascade_AndDeletion() {
        // 1. Create Workspace
        Workspace ws = workspaceService.createWorkspace("Team Alpha", "Alpha projects", "#2563eb", owner.getEmail());
        assertNotNull(ws.getId());
        assertEquals("Team Alpha", ws.getName());

        // 2. Create Folder inside Workspace
        Folder folder = folderService.createFolder("Sprint 1", ws.getName(), null, owner.getEmail());
        assertNotNull(folder.getId());
        assertEquals(ws.getName(), folder.getWorkspaceName());

        // 3. Create Document inside Workspace and Folder
        Document doc = documentService.createDocument("Design Spec", "# Spec", "DOC", folder.getId(), ws.getName(), owner.getEmail());
        assertNotNull(doc.getId());
        assertEquals("Team Alpha", doc.getWorkspaceName());
        assertEquals(folder.getId(), doc.getFolder().getId());

        // 4. Rename Workspace -> Verify cascade to folder and document
        Workspace updatedWs = workspaceService.updateWorkspace(ws.getId(), "Team Beta", "Renamed", "#10b981", owner.getEmail());
        assertEquals("Team Beta", updatedWs.getName());

        Folder refreshedFolder = folderRepository.findById(folder.getId()).orElseThrow();
        assertEquals("Team Beta", refreshedFolder.getWorkspaceName());

        Document refreshedDoc = documentRepository.findById(doc.getId()).orElseThrow();
        assertEquals("Team Beta", refreshedDoc.getWorkspaceName());

        // 5. Delete Workspace -> Verify cascade deletion of documents and folders
        workspaceService.deleteWorkspace(ws.getId(), owner.getEmail());
        assertFalse(workspaceRepository.existsById(ws.getId()));
        assertFalse(folderRepository.existsById(folder.getId()));
        assertFalse(documentRepository.existsById(doc.getId()));
    }

    @Test
    public void testFolderCreation_Subfolder_AndSafeDeletion() {
        Workspace ws = workspaceService.createWorkspace("Folder Test WS", "Testing folders", "#3b82f6", owner.getEmail());

        // Create Parent Folder
        Folder parentFolder = folderService.createFolder("Parent Folder", ws.getName(), null, owner.getEmail());

        // Create Subfolder
        Folder subfolder = folderService.createFolder("Child Subfolder", ws.getName(), parentFolder.getId(), owner.getEmail());
        assertEquals(parentFolder.getId(), subfolder.getParentFolder().getId());

        // Create document inside Parent Folder
        Document docInParent = documentService.createDocument("Parent Doc", "Content", "DOC", parentFolder.getId(), ws.getName(), owner.getEmail());

        // Delete Parent Folder -> Subfolder should be deleted, and document should be cleanly detached
        folderService.deleteFolder(parentFolder.getId(), owner.getEmail());

        assertFalse(folderRepository.existsById(parentFolder.getId()));
        assertFalse(folderRepository.existsById(subfolder.getId()));

        Document docAfter = documentRepository.findById(docInParent.getId()).orElseThrow();
        assertNull(docAfter.getFolder(), "Document should be safely detached to root workspace level");
        assertEquals(ws.getName(), docAfter.getWorkspaceName());
    }

    @Test
    public void testDocumentMoveBetweenFoldersAndWorkspaces() {
        Workspace ws1 = workspaceService.createWorkspace("WS One", "First", "#2563eb", owner.getEmail());
        Workspace ws2 = workspaceService.createWorkspace("WS Two", "Second", "#10b981", owner.getEmail());

        Folder f1 = folderService.createFolder("F1 in WS1", ws1.getName(), null, owner.getEmail());
        Folder f2 = folderService.createFolder("F2 in WS2", ws2.getName(), null, owner.getEmail());

        Document doc = documentService.createDocument("Mobile Doc", "Body", "DOC", f1.getId(), ws1.getName(), owner.getEmail());
        assertEquals(f1.getId(), doc.getFolder().getId());
        assertEquals("WS One", doc.getWorkspaceName());

        // Move to F2 in WS2
        Document moved = documentService.moveDocument(doc.getId(), f2.getId(), ws2.getName(), owner.getEmail());
        assertEquals(f2.getId(), moved.getFolder().getId());
        assertEquals("WS Two", moved.getWorkspaceName());

        // Move to root of WS2 (null folder)
        Document movedToRoot = documentService.moveDocument(doc.getId(), null, ws2.getName(), owner.getEmail());
        assertNull(movedToRoot.getFolder());
        assertEquals("WS Two", movedToRoot.getWorkspaceName());
    }
}
