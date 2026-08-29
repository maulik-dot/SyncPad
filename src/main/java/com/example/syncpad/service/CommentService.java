package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.request.CreateCommentRequest;
import com.example.syncpad.dto.response.DocumentCommentResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentComment;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class CommentService {

    private final DocumentCommentRepository commentRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final WebhookService webhookService;

    public CommentService(
            DocumentCommentRepository commentRepository,
            DocumentRepository documentRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            DocumentPermissionRepository permissionRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            @Lazy SimpMessagingTemplate messagingTemplate,
            @Lazy NotificationService notificationService,
            @Lazy AuditLogService auditLogService,
            @Lazy WebhookService webhookService
    ) {
        this.commentRepository = commentRepository;
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.permissionRepository = permissionRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
        this.auditLogService = auditLogService;
        this.webhookService = webhookService;
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    private Document findDocumentById(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));
    }

    public Role getEffectiveRole(Document document, User user) {
        if (document == null || user == null) return null;

        // 1. Document Owner has OWNER permissions
        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            return Role.OWNER;
        }

        // 2. Explicit DocumentPermission
        var docPerm = permissionRepository.findByUserAndDocument(user, document);
        if (docPerm.isPresent() && !docPerm.get().isExpired()) {
            return docPerm.get().getRole();
        }

        // 3. Inherited WorkspacePermission
        if (document.getWorkspaceName() != null) {
            var wsOpt = workspaceRepository.findByName(document.getWorkspaceName());
            if (wsOpt.isPresent()) {
                var ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return Role.OWNER;
                }
                var wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent() && !wsPerm.get().isExpired()) {
                    return wsPerm.get().getRole();
                }
            }
        }

        return null;
    }

    @Transactional(readOnly = true)
    public List<DocumentCommentResponse> getComments(Long documentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to comments on this document");
        }

        List<DocumentComment> comments = commentRepository.findByDocumentIdOrderByCreatedAtAsc(documentId);

        // Filter for top-level comments and map to hierarchy
        return comments.stream()
                .filter(c -> c.getParent() == null)
                .map(DocumentCommentResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public DocumentCommentResponse createComment(Long documentId, String userEmail, CreateCommentRequest request) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to comment on this document");
        }

        DocumentComment parent = null;
        if (request.getParentId() != null) {
            parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent comment not found"));
            if (!parent.getDocument().getId().equals(documentId)) {
                throw new IllegalArgumentException("Parent comment does not belong to this document");
            }
        }

        DocumentComment comment = new DocumentComment(
                document,
                user,
                request.getText(),
                request.getAnchorText(),
                parent
        );

        DocumentComment saved = commentRepository.save(comment);
        DocumentCommentResponse response = DocumentCommentResponse.fromEntity(saved);

        // 1. Real-time WebSocket event
        broadcastCommentEvent(document.getId(), "COMMENT_ADDED", response, user);

        // 2. Notification to document owner
        if (notificationService != null && document.getOwner() != null && !document.getOwner().getId().equals(user.getId())) {
            notificationService.createCommentNotification(document.getOwner(), user, document, request.getText());
        }

        // 3. Notification to parent author if reply
        if (notificationService != null && parent != null && parent.getAuthor() != null
                && !parent.getAuthor().getId().equals(user.getId())
                && (document.getOwner() == null || !parent.getAuthor().getId().equals(document.getOwner().getId()))) {
            notificationService.createCommentNotification(parent.getAuthor(), user, document, request.getText());
        }

        // 4. Audit log entry
        if (auditLogService != null) {
            String snippet = request.getText() != null && request.getText().length() > 50
                    ? request.getText().substring(0, 47) + "..." : request.getText();
            String details = parent != null ? "Replied to comment #" + parent.getId() + ": " + snippet : "Added comment: " + snippet;
            auditLogService.log(user, null, document, "COMMENT_ADDED", details);
        }

        // 5. Webhook dispatch
        if (webhookService != null && document.getWorkspaceName() != null) {
            workspaceRepository.findByName(document.getWorkspaceName()).ifPresent(ws ->
                webhookService.dispatch(ws.getId(), "COMMENT_ADDED", Map.of(
                        "documentId", document.getId(),
                        "commentId", saved.getId(),
                        "author", user.getEmail(),
                        "authorName", user.getName(),
                        "text", saved.getText()
                ))
            );
        }

        return response;
    }

    @Transactional
    public DocumentCommentResponse resolveComment(Long documentId, Long commentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to modify comments on this document");
        }

        DocumentComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        if (!comment.getDocument().getId().equals(documentId)) {
            throw new IllegalArgumentException("Comment does not belong to the specified document");
        }

        comment.setResolved(!comment.isResolved());
        comment.setUpdatedAt(LocalDateTime.now());
        DocumentComment updated = commentRepository.save(comment);
        DocumentCommentResponse response = DocumentCommentResponse.fromEntity(updated);

        // Broadcast real-time event
        broadcastCommentEvent(document.getId(), "COMMENT_RESOLVED", response, user);

        // Audit log entry
        if (auditLogService != null) {
            String action = comment.isResolved() ? "Resolved comment #" + commentId : "Reopened comment #" + commentId;
            auditLogService.log(user, null, document, "COMMENT_RESOLVED", action);
        }

        return response;
    }

    @Transactional
    public void deleteComment(Long documentId, Long commentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to this document");
        }

        DocumentComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        if (!comment.getDocument().getId().equals(documentId)) {
            throw new IllegalArgumentException("Comment does not belong to the specified document");
        }

        boolean isAuthor = comment.getAuthor().getId().equals(user.getId());
        boolean isOwnerOrAdmin = effectiveRole == Role.OWNER || effectiveRole == Role.ADMIN;

        if (!isAuthor && !isOwnerOrAdmin) {
            throw new PermissionDeniedException("You do not have permission to delete this comment");
        }

        commentRepository.delete(comment);

        // Broadcast real-time event
        broadcastCommentEvent(documentId, "COMMENT_DELETED", Map.of("commentId", commentId, "documentId", documentId), user);

        // Audit log entry
        if (auditLogService != null) {
            auditLogService.log(user, null, document, "COMMENT_DELETED", "Deleted comment #" + commentId);
        }
    }

    private void broadcastCommentEvent(Long documentId, String eventType, Object payload, User sender) {
        if (messagingTemplate == null || documentId == null) return;
        try {
            Map<String, Object> event = new java.util.HashMap<>();
            event.put("type", eventType);
            event.put("documentId", documentId);
            event.put("senderEmail", sender != null ? sender.getEmail() : "system");
            event.put("senderName", sender != null ? sender.getName() : "System");
            event.put("timestamp", LocalDateTime.now().toString());
            event.put("comment", payload);

            messagingTemplate.convertAndSend("/topic/documents." + documentId, (Object) event);
            messagingTemplate.convertAndSend("/topic/documents/" + documentId, (Object) event);
        } catch (Exception ignored) {
            // Client may be offline
        }
    }
}
