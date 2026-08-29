package com.example.syncpad.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.example.syncpad.dto.request.CreateCommentRequest;
import com.example.syncpad.dto.response.DocumentCommentResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentComment;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.User;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

class CommentServiceTest {

    @Mock
    private DocumentCommentRepository commentRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private DocumentPermissionRepository documentPermissionRepository;

    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private NotificationService notificationService;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private WebhookService webhookService;

    @InjectMocks
    private CommentService commentService;

    private User user;
    private Document doc;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        user = new User("Alice", "alice@example.com", "pass");
        user.setId(1L);

        doc = new Document("Test Doc", "Content", FileType.DOC, "Workspace1", null, user);
        doc.setId(10L);
    }

    @Test
    void testGetComments() {
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        DocumentComment comment = new DocumentComment(doc, user, "Great point!", null, null);
        when(commentRepository.findByDocumentIdOrderByCreatedAtAsc(10L))
                .thenReturn(List.of(comment));

        List<DocumentCommentResponse> comments = commentService.getComments(10L, "alice@example.com");
        assertEquals(1, comments.size());
        assertEquals("Great point!", comments.get(0).getText());
    }

    @Test
    void testCreateComment() {
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        CreateCommentRequest request = new CreateCommentRequest();
        request.setText("New test feedback");

        when(commentRepository.save(any(DocumentComment.class))).thenAnswer(i -> {
            DocumentComment c = i.getArgument(0);
            c.setId(100L);
            return c;
        });

        DocumentCommentResponse response = commentService.createComment(10L, "alice@example.com", request);
        assertNotNull(response);
        assertEquals("New test feedback", response.getText());
        verify(commentRepository).save(any(DocumentComment.class));
    }

    @Test
    void testResolveComment() {
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        DocumentComment comment = new DocumentComment(doc, user, "Fix this typo", null, null);
        comment.setId(50L);
        when(commentRepository.findById(50L)).thenReturn(Optional.of(comment));
        when(commentRepository.save(any(DocumentComment.class))).thenAnswer(i -> i.getArgument(0));

        DocumentCommentResponse response = commentService.resolveComment(10L, 50L, "alice@example.com");
        assertNotNull(response);
        assertTrue(response.isResolved());
    }
}
