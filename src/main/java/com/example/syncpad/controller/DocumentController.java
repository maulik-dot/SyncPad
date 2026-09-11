package com.example.syncpad.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.example.syncpad.dto.request.AddTagRequest;
import com.example.syncpad.dto.response.TagResponse;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.request.AttachPdfRequest;
import com.example.syncpad.dto.request.CreateCommentRequest;
import com.example.syncpad.dto.request.CreateDocumentRequest;
import com.example.syncpad.dto.request.CreateShareLinkRequest;
import com.example.syncpad.dto.request.ShareDocumentRequest;
import com.example.syncpad.dto.request.UpdateDocumentRequest;
import com.example.syncpad.dto.response.DocumentCommentResponse;
import com.example.syncpad.dto.response.DocumentDetailResponse;
import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.dto.response.DocumentStatsResponse;
import com.example.syncpad.dto.response.DocumentVersionResponse;
import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.dto.response.ShareLinkResponse;
import com.example.syncpad.dto.response.SharedDocumentResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.service.DocumentService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final com.example.syncpad.service.AuditLogService auditLogService;
    private final com.example.syncpad.service.DocumentExportService exportService;

    public DocumentController(
            DocumentService documentService,
            com.example.syncpad.service.AuditLogService auditLogService,
            com.example.syncpad.service.DocumentExportService exportService
    ) {
        this.documentService = documentService;
        this.auditLogService = auditLogService;
        this.exportService = exportService;
    }

    public static class RenameDocumentRequest {
        @jakarta.validation.constraints.NotBlank(message = "Title cannot be blank")
        private String title;

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
    }

    public static class UpdateDocumentPermissionRequest {
        private Long userId;
        private String email;
        private Role role;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    @PostMapping
    public DocumentResponse createDocument(@Valid @RequestBody CreateDocumentRequest request, Authentication authentication) {
        Document doc = documentService.createDocument(
                request.getTitle(),
                request.getContent(),
                request.getFileType(),
                request.getFolderId(),
                request.getWorkspaceName(),
                authentication.getName()
        );
        return documentService.toResponse(doc, authentication.getName());
    }

    @GetMapping
    public List<DocumentResponse> getAllDocuments(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long folderId,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String workspace,
            @RequestParam(required = false, defaultValue = "false") boolean rootOnly,
            Authentication authentication
    ) {
        if (tag != null && !tag.trim().isEmpty()) {
            return documentService.getDocumentsByTag(tag.trim(), authentication.getName());
        }
        List<Document> docs;
        if (folderId != null) {
            docs = documentService.getDocumentsByFolder(folderId, authentication.getName());
        } else {
            docs = documentService.getAccessibleDocuments(authentication.getName(), type, workspace, rootOnly);
        }
        return documentService.toResponses(docs, authentication.getName());
    }

    @GetMapping("/starred")
    public List<DocumentResponse> getStarredDocuments(Authentication authentication) {
        return documentService.getStarredDocuments(authentication.getName());
    }

    @GetMapping("/search")
    public List<DocumentResponse> searchDocuments(
            @RequestParam("q") String query,
            Authentication authentication
    ) {
        return documentService.searchDocuments(query, authentication.getName());
    }

    @GetMapping("/shared-with-me")
    public List<DocumentResponse> getSharedWithMeDocuments(Authentication authentication) {
        return documentService.getSharedWithMeDocuments(authentication.getName());
    }

    @GetMapping("/{id}")
    public DocumentResponse getDocument(@PathVariable Long id, Authentication authentication) {
        return documentService.toResponse(documentService.getDocument(id, authentication.getName()), authentication.getName());
    }

    @GetMapping("/{id}/detail")
    public DocumentDetailResponse getDocumentDetail(@PathVariable Long id, Authentication authentication) {
        return documentService.getDocumentDetail(id, authentication.getName());
    }

    @GetMapping("/{id}/stats")
    public DocumentStatsResponse getDocumentStats(@PathVariable Long id, Authentication authentication) {
        return documentService.getDocumentStats(id, authentication.getName());
    }

    @PatchMapping("/{id}/rename")
    public DocumentResponse renameDocumentPatch(
            @PathVariable Long id,
            @Valid @RequestBody RenameDocumentRequest request,
            Authentication authentication
    ) {
        return documentService.toResponse(documentService.renameDocument(id, request.getTitle(), authentication.getName()), authentication.getName());
    }

    @PutMapping("/{id}/rename")
    public DocumentResponse renameDocumentPut(
            @PathVariable Long id,
            @Valid @RequestBody RenameDocumentRequest request,
            Authentication authentication
    ) {
        return documentService.toResponse(documentService.renameDocument(id, request.getTitle(), authentication.getName()), authentication.getName());
    }

    @PutMapping("/{id}")
    public DocumentResponse updateDocument(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDocumentRequest request,
            Authentication authentication
    ) {
        return documentService.toResponse(documentService.updateDocument(id, request.getTitle(), request.getContent(), authentication.getName()), authentication.getName());
    }

    @PostMapping("/{id}/trash")
    public DocumentResponse trashDocument(@PathVariable Long id, Authentication authentication) {
        return documentService.toResponse(documentService.trashDocument(id, authentication.getName()), authentication.getName());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteDocument(@PathVariable Long id, Authentication authentication) {
        documentService.trashDocument(id, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Document moved to trash", "id", id));
    }

    @GetMapping("/trash")
    public List<DocumentResponse> getTrashedDocuments(Authentication authentication) {
        return documentService.toResponses(documentService.getTrashedDocuments(authentication.getName()), authentication.getName());
    }

    @PostMapping("/{id}/restore-trash")
    public DocumentResponse restoreTrashDocument(@PathVariable Long id, Authentication authentication) {
        return documentService.toResponse(documentService.restoreDocument(id, authentication.getName()), authentication.getName());
    }

    @PostMapping("/{id}/restore")
    public DocumentResponse restoreDocument(@PathVariable Long id, Authentication authentication) {
        Document doc = documentService.restoreDocument(id, authentication.getName());
        return DocumentResponse.from(doc, false);
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Map<String, Object>> permanentlyDeleteDocument(@PathVariable Long id, Authentication authentication) {
        documentService.permanentlyDeleteDocument(id, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Document permanently deleted", "id", id));
    }

    @DeleteMapping("/trash/empty")
    public ResponseEntity<Map<String, Object>> emptyTrash(Authentication authentication) {
        int count = documentService.emptyTrash(authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Trash emptied successfully", "count", count));
    }

    @PostMapping("/trash/restore-bulk")
    public ResponseEntity<Map<String, Object>> restoreBulk(@RequestBody Map<String, List<Long>> request, Authentication authentication) {
        List<Long> ids = request.getOrDefault("documentIds", List.of());
        int count = documentService.restoreBulk(ids, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Documents restored successfully", "count", count));
    }

    @PostMapping("/trash/delete-bulk")
    public ResponseEntity<Map<String, Object>> permanentDeleteBulk(@RequestBody Map<String, List<Long>> request, Authentication authentication) {
        List<Long> ids = request.getOrDefault("documentIds", List.of());
        int count = documentService.permanentDeleteBulk(ids, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Documents permanently deleted", "count", count));
    }

    @PostMapping("/{id}/tags")
    public DocumentResponse addTag(
            @PathVariable Long id,
            @RequestBody AddTagRequest request,
            Authentication authentication
    ) {
        return documentService.addTagToDocument(id, request, authentication.getName());
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public ResponseEntity<Map<String, Object>> removeTag(
            @PathVariable Long id,
            @PathVariable Long tagId,
            Authentication authentication
    ) {
        DocumentResponse updated = documentService.removeTagFromDocument(id, tagId, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "Tag removed from document", "document", updated));
    }

    @PostMapping("/{id}/star")
    public DocumentResponse starDocument(@PathVariable Long id, Authentication authentication) {
        return documentService.starDocument(id, authentication.getName());
    }

    @DeleteMapping("/{id}/star")
    public DocumentResponse unstarDocument(@PathVariable Long id, Authentication authentication) {
        return documentService.unstarDocument(id, authentication.getName());
    }

    @PostMapping("/{id}/share")
    public PermissionResponse shareDocument(
            @PathVariable Long id,
            @Valid @RequestBody ShareDocumentRequest request,
            Authentication authentication
    ) {
        return documentService.shareDocument(
                id,
                authentication.getName(),
                request.getEmail(),
                request.getRole(),
                request.getDurationHours()
        );
    }

    @GetMapping("/{id}/permissions")
    public List<PermissionResponse> getPermissions(@PathVariable Long id, Authentication authentication) {
        return documentService.getPermissions(id, authentication.getName());
    }

    @PostMapping("/{id}/permissions")
    public PermissionResponse updateDocumentPermission(
            @PathVariable Long id,
            @RequestBody UpdateDocumentPermissionRequest request,
            Authentication authentication
    ) {
        return documentService.updateDocumentPermission(
                id,
                request.getUserId(),
                request.getEmail(),
                request.getRole(),
                authentication.getName()
        );
    }

    @DeleteMapping("/{id}/permissions/{userId}")
    public ResponseEntity<Void> removeDocumentPermission(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication
    ) {
        documentService.removeDocumentPermission(id, userId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/versions")
    public List<DocumentVersionResponse> getVersions(@PathVariable Long id, Authentication authentication) {
        return documentService.getVersions(id, authentication.getName());
    }

    @PostMapping("/{id}/restore/{versionNumber}")
    public DocumentResponse restoreVersion(
            @PathVariable Long id,
            @PathVariable Integer versionNumber,
            Authentication authentication
    ) {
        return DocumentResponse.from(documentService.restoreVersion(id, versionNumber, authentication.getName()));
    }

    @PostMapping("/{id}/share-link")
    public ShareLinkResponse generateShareLink(
            @PathVariable Long id,
            @Valid @RequestBody CreateShareLinkRequest request,
            Authentication authentication
    ) {
        return documentService.generateShareLink(id, authentication.getName(), request);
    }

    @GetMapping("/{id}/share-link")
    public ResponseEntity<ShareLinkResponse> getActiveShareLink(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return documentService.getActiveShareLink(id, authentication.getName())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/share/{token}")
    public SharedDocumentResponse getDocumentByShareToken(
            @PathVariable String token,
            Authentication authentication
    ) {
        String email = (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
        return documentService.getDocumentByShareToken(token, email);
    }

    @PutMapping("/share/{token}")
    public SharedDocumentResponse updateDocumentByShareToken(
            @PathVariable String token,
            @Valid @RequestBody UpdateDocumentRequest request
    ) {
        return documentService.updateDocumentByShareToken(token, request);
    }

    @PostMapping("/share-link/{token}/revoke")
    public ResponseEntity<Void> revokeShareLink(
            @PathVariable String token,
            Authentication authentication
    ) {
        documentService.revokeShareLink(token, authentication.getName());
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // COMMENTS ENDPOINTS
    // ==========================================

    @GetMapping("/{id}/comments")
    public List<DocumentCommentResponse> getComments(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return documentService.getComments(id, authentication.getName());
    }

    @PostMapping("/{id}/comments")
    public DocumentCommentResponse createComment(
            @PathVariable Long id,
            @Valid @RequestBody CreateCommentRequest request,
            Authentication authentication
    ) {
        return documentService.createComment(id, authentication.getName(), request);
    }

    @PatchMapping("/{id}/comments/{commentId}/resolve")
    public DocumentCommentResponse resolveComment(
            @PathVariable Long id,
            @PathVariable Long commentId,
            Authentication authentication
    ) {
        return documentService.resolveComment(id, commentId, authentication.getName());
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long id,
            @PathVariable Long commentId,
            Authentication authentication
    ) {
        documentService.deleteComment(id, commentId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // PDF ATTACHMENT ENDPOINTS
    // ==========================================

    @PostMapping("/{id}/pdf")
    public DocumentResponse attachPdf(
            @PathVariable Long id,
            @Valid @RequestBody AttachPdfRequest request,
            Authentication authentication
    ) {
        return documentService.toResponse(documentService.attachPdf(id, request.getFileName(), request.getPdfUrl(), authentication.getName()), authentication.getName());
    }

    @DeleteMapping("/{id}/pdf")
    public DocumentResponse detachPdf(
            @PathVariable Long id,
            Authentication authentication
    ) {
        Document doc = documentService.detachPdf(id, authentication.getName());
        return DocumentResponse.from(doc, false);
    }

    @GetMapping("/{id}/activity")
    public org.springframework.data.domain.Page<com.example.syncpad.dto.response.AuditLogResponse> getDocumentActivity(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        return auditLogService.getDocumentActivity(id, authentication.getName(), page, size);
    }

    @GetMapping("/{id}/export")
    public org.springframework.http.ResponseEntity<byte[]> exportDocument(
            @PathVariable Long id,
            @RequestParam(defaultValue = "md") String format,
            Authentication authentication
    ) {
        return exportService.exportDocument(id, format, authentication.getName());
    }

    public static class MentionCollaboratorRequest {
        private String targetEmail;
        private Long targetUserId;
        private String targetName;

        public String getTargetEmail() { return targetEmail; }
        public void setTargetEmail(String targetEmail) { this.targetEmail = targetEmail; }
        public Long getTargetUserId() { return targetUserId; }
        public void setTargetUserId(Long targetUserId) { this.targetUserId = targetUserId; }
        public String getTargetName() { return targetName; }
        public void setTargetName(String targetName) { this.targetName = targetName; }
    }

    @PostMapping("/{id}/mention")
    public ResponseEntity<Void> mentionCollaborator(
            @PathVariable Long id,
            @RequestBody MentionCollaboratorRequest request,
            Authentication authentication
    ) {
        documentService.notifyCollaboratorMention(id, authentication.getName(), request.getTargetEmail(), request.getTargetUserId(), request.getTargetName());
        return ResponseEntity.ok().build();
    }
}
