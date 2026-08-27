package com.example.syncpad.controller;

import java.util.List;
import java.util.stream.Collectors;

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

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
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
        return DocumentResponse.from(doc);
    }

    @GetMapping
    public List<DocumentResponse> getAllDocuments(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long folderId,
            Authentication authentication
    ) {
        List<Document> docs;
        if (folderId != null) {
            docs = documentService.getDocumentsByFolder(folderId, authentication.getName());
        } else {
            docs = documentService.getAccessibleDocuments(authentication.getName(), type);
        }
        return docs.stream().map(DocumentResponse::from).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public DocumentResponse getDocument(@PathVariable Long id, Authentication authentication) {
        return DocumentResponse.from(documentService.getDocument(id, authentication.getName()));
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
        return DocumentResponse.from(documentService.renameDocument(id, request.getTitle(), authentication.getName()));
    }

    @PutMapping("/{id}/rename")
    public DocumentResponse renameDocumentPut(
            @PathVariable Long id,
            @Valid @RequestBody RenameDocumentRequest request,
            Authentication authentication
    ) {
        return DocumentResponse.from(documentService.renameDocument(id, request.getTitle(), authentication.getName()));
    }

    @PutMapping("/{id}")
    public DocumentResponse updateDocument(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDocumentRequest request,
            Authentication authentication
    ) {
        return DocumentResponse.from(documentService.updateDocument(id, request.getTitle(), request.getContent(), authentication.getName()));
    }

    @DeleteMapping("/{id}")
    public void deleteDocument(@PathVariable Long id, Authentication authentication) {
        documentService.deleteDocument(id, authentication.getName());
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
                request.getRole()
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

    @GetMapping("/share/{token}")
    public SharedDocumentResponse getDocumentByShareToken(
            @PathVariable String token,
            Authentication authentication
    ) {
        String email = (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
        return documentService.getDocumentByShareToken(token, email);
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
        return DocumentResponse.from(documentService.attachPdf(id, request.getFileName(), request.getPdfUrl(), authentication.getName()));
    }

    @DeleteMapping("/{id}/pdf")
    public DocumentResponse detachPdf(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return DocumentResponse.from(documentService.detachPdf(id, authentication.getName()));
    }
}
