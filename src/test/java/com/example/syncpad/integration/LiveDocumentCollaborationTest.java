package com.example.syncpad.integration;

import java.security.Principal;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.syncpad.controller.DocumentWebSocketController;
import com.example.syncpad.crdt.CrdtCharacter;
import com.example.syncpad.crdt.CrdtDocumentEngine;
import com.example.syncpad.crdt.CrdtId;
import com.example.syncpad.crdt.CrdtOperation;
import com.example.syncpad.dto.message.DocumentEditMessage;
import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.Notification;
import com.example.syncpad.entity.NotificationType;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.NotificationRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.example.syncpad.service.DocumentService;
import com.example.syncpad.service.FolderService;
import com.example.syncpad.service.WorkspaceService;

@SpringBootTest
public class LiveDocumentCollaborationTest {

    @Autowired private DocumentService documentService;
    @Autowired private FolderService folderService;
    @Autowired private WorkspaceService workspaceService;
    @Autowired private DocumentWebSocketController webSocketController;

    @Autowired private UserRepository userRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private FolderRepository folderRepository;
    @Autowired private DocumentPermissionRepository permissionRepository;
    @Autowired private WorkspacePermissionRepository workspacePermissionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private User maulik1;
    private User maulik2;
    private Workspace designWorkspace;
    private Folder designFolder;
    private Document designDoc;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        String email1 = "test_collab1_" + ts + "@example.com";
        String email2 = "test_collab2_" + ts + "@example.com";

        maulik1 = userRepository.save(new User("Maulik Mahey", email1, passwordEncoder.encode("password123")));
        maulik2 = userRepository.save(new User("Maulik 22282", email2, passwordEncoder.encode("password123")));

        // Create Workspace with trailing space to test whitespace resilience
        designWorkspace = workspaceService.createWorkspace("Design ", "Design Workspace", "#3b82f6", maulik1.getEmail());

        // Create folder inside workspace
        designFolder = folderService.createFolder("Design Folder", designWorkspace.getName(), null, maulik1.getEmail());

        // Add user2 as EDITOR in workspace
        workspaceService.shareWorkspace(designWorkspace.getId(), maulik1.getEmail(), maulik2.getEmail(), Role.EDITOR);

        // Create Document inside the folder and workspace
        designDoc = documentService.createDocument("Design Doc", "<p>Initial Collaboration Text</p>", "DOC", designFolder.getId(), designWorkspace.getName(), maulik1.getEmail());
    }

    @Test
    void testBothUsersHaveEffectiveEditPermissionEvenWithTrailingWhitespace() {
        // Maulik 1 is owner
        Role role1 = documentService.getEffectiveRole(designDoc, maulik1);
        assertEquals(Role.OWNER, role1);

        // Maulik 2 inherits EDITOR role from workspace (or folder) despite whitespace in original input
        Role role2 = documentService.getEffectiveRole(designDoc, maulik2);
        assertEquals(Role.EDITOR, role2);

        // Maulik 2 can view and update document
        assertDoesNotThrow(() -> {
            Document doc = documentService.getDocument(designDoc.getId(), maulik2.getEmail());
            assertNotNull(doc);
            assertEquals("Design Doc", doc.getTitle());
        });

        assertDoesNotThrow(() -> {
            documentService.updateDocument(designDoc.getId(), "Design Doc v2", "<p>Updated by Maulik 2</p>", maulik2.getEmail());
        });
    }

    @Test
    void testWorkspaceDocumentFilteringAndSharedWithMe() {
        // Verify getAccessibleDocuments matches with trimmed workspace filter
        List<Document> filteredDocs = documentService.getAccessibleDocuments(maulik2.getEmail(), null, "Design");
        assertFalse(filteredDocs.isEmpty());
        assertTrue(filteredDocs.stream().anyMatch(d -> d.getId().equals(designDoc.getId())));

        // Verify shareDocument explicitly grants document-level permission and appears in shared-with-me
        documentService.shareDocument(designDoc.getId(), maulik1.getEmail(), maulik2.getEmail(), Role.EDITOR);

        // Test shared-with-me doesn't throw LazyInitializationException
        List<DocumentResponse> sharedDocs = documentService.getSharedWithMeDocuments(maulik2.getEmail());
        assertNotNull(sharedDocs);
        assertTrue(sharedDocs.stream().anyMatch(d -> d.getId().equals(designDoc.getId())));
    }

    @Test
    void testSimultaneousLiveCollaborationEditEvents() {
        Principal p1 = () -> maulik1.getEmail();
        Principal p2 = () -> maulik2.getEmail();

        // User 1 sends edit
        DocumentEditMessage edit1 = new DocumentEditMessage(
                designDoc.getId(),
                "Design Doc",
                "<p>Edit from Maulik 1</p>",
                maulik1.getEmail(),
                "Maulik Mahey",
                "EDIT"
        );

        // User 2 sends edit
        DocumentEditMessage edit2 = new DocumentEditMessage(
                designDoc.getId(),
                "Design Doc",
                "<p>Edit from Maulik 2</p>",
                maulik2.getEmail(),
                "Maulik 22282",
                "EDIT"
        );

        assertDoesNotThrow(() -> webSocketController.handleDocumentEdit(designDoc.getId(), edit1, p1, null));
        assertDoesNotThrow(() -> webSocketController.handleDocumentEdit(designDoc.getId(), edit2, p2, null));
    }

    @Test
    void testConcurrentCrdtOperationsByBothUsers() throws InterruptedException {
        Principal p1 = () -> maulik1.getEmail();
        Principal p2 = () -> maulik2.getEmail();

        int opsPerUser = 25;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        AtomicInteger successCount = new AtomicInteger(0);

        // User 1 concurrent inserts
        executor.submit(() -> {
            try {
                startLatch.await();
                CrdtId prev = null;
                for (int i = 0; i < opsPerUser; i++) {
                    CrdtId current = new CrdtId("u1", i + 1);
                    CrdtOperation op = CrdtOperation.insert(designDoc.getId(), current, prev, null, "A", maulik1.getEmail());
                    webSocketController.handleCrdtOperation(designDoc.getId(), op, p1);
                    prev = current;
                    successCount.incrementAndGet();
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                doneLatch.countDown();
            }
        });

        // User 2 concurrent inserts
        executor.submit(() -> {
            try {
                startLatch.await();
                CrdtId prev = null;
                for (int i = 0; i < opsPerUser; i++) {
                    CrdtId current = new CrdtId("u2", i + 1);
                    CrdtOperation op = CrdtOperation.insert(designDoc.getId(), current, prev, null, "B", maulik2.getEmail());
                    webSocketController.handleCrdtOperation(designDoc.getId(), op, p2);
                    prev = current;
                    successCount.incrementAndGet();
                }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean completed = doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "Concurrent CRDT operations completed within timeout");
        assertEquals(opsPerUser * 2, successCount.get(), "All CRDT operations processed successfully");
    }

    @Test
    void testRgaConvergenceDeterministicOrdering() {
        CrdtDocumentEngine engine = new CrdtDocumentEngine(designDoc.getId());
        engine.loadFromText("Base", "seed");

        // Two users concurrently insert at the exact same location after 'Base'
        List<CrdtCharacter> chars = engine.getCharacters();
        CrdtId lastId = chars.get(chars.size() - 1).getId();

        // Maulik1 inserts 'X'
        CrdtId id1 = new CrdtId("maulik1", 100);

        // Maulik2 inserts 'Y'
        CrdtId id2 = new CrdtId("maulik2", 100);

        // Commutative test: Engine A applies op1 then op2
        CrdtDocumentEngine engineA = new CrdtDocumentEngine(designDoc.getId());
        engineA.loadFromText("Base", "seed");
        CrdtId lastIdA = engineA.getCharacters().get(engineA.getCharacters().size() - 1).getId();
        engineA.applyOperation(CrdtOperation.insert(designDoc.getId(), id1, lastIdA, null, "X", maulik1.getEmail()));
        engineA.applyOperation(CrdtOperation.insert(designDoc.getId(), id2, lastIdA, null, "Y", maulik2.getEmail()));

        // Engine B applies op2 then op1
        CrdtDocumentEngine engineB = new CrdtDocumentEngine(designDoc.getId());
        engineB.loadFromText("Base", "seed");
        CrdtId lastIdB = engineB.getCharacters().get(engineB.getCharacters().size() - 1).getId();
        engineB.applyOperation(CrdtOperation.insert(designDoc.getId(), id2, lastIdB, null, "Y", maulik2.getEmail()));
        engineB.applyOperation(CrdtOperation.insert(designDoc.getId(), id1, lastIdB, null, "X", maulik1.getEmail()));

        // Both engines MUST converge to the exact same text string!
        assertEquals(engineA.toText(), engineB.toText(), "CRDT engines converged to identical document content regardless of message arrival order");
    }

    @Test
    void testLiveCollaboratorMentionCreatesNotificationAndBroadcasts() {
        Principal p1 = () -> maulik1.getEmail();

        java.util.Map<String, Object> mentionMsg = new java.util.HashMap<>();
        mentionMsg.put("mentionedEmail", maulik2.getEmail());
        mentionMsg.put("mentionedName", maulik2.getName());
        mentionMsg.put("mentionedUserId", maulik2.getId());

        assertDoesNotThrow(() -> webSocketController.handleDocumentMention(designDoc.getId(), mentionMsg, p1));

        List<Notification> notifications = notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(maulik2.getEmail());
        assertFalse(notifications.isEmpty(), "Notification should be generated for mentioned user");
        Notification mentionNote = notifications.stream()
                .filter(n -> n.getType() == NotificationType.DOCUMENT_MENTION)
                .findFirst()
                .orElse(null);
        assertNotNull(mentionNote, "A DOCUMENT_MENTION notification should exist");
        assertTrue(mentionNote.getMessage().contains("mentioned you in 'Design Doc'"));
    }
}
