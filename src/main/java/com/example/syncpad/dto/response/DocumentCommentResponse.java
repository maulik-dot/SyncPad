package com.example.syncpad.dto.response;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.example.syncpad.entity.DocumentComment;

public class DocumentCommentResponse {

    private Long id;
    private Long documentId;
    private Long authorId;
    private String authorName;
    private String authorEmail;
    private String text;
    private String anchorText;
    private boolean isResolved;
    private Long parentId;
    private List<DocumentCommentResponse> replies = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public DocumentCommentResponse() {}

    public static DocumentCommentResponse fromEntity(DocumentComment comment) {
        DocumentCommentResponse resp = new DocumentCommentResponse();
        resp.setId(comment.getId());
        if (comment.getDocument() != null) {
            resp.setDocumentId(comment.getDocument().getId());
        }
        if (comment.getAuthor() != null) {
            resp.setAuthorId(comment.getAuthor().getId());
            resp.setAuthorName(comment.getAuthor().getName());
            resp.setAuthorEmail(comment.getAuthor().getEmail());
        }
        resp.setText(comment.getText());
        resp.setAnchorText(comment.getAnchorText());
        resp.setResolved(comment.isResolved());
        if (comment.getParent() != null) {
            resp.setParentId(comment.getParent().getId());
        }
        if (comment.getReplies() != null && !comment.getReplies().isEmpty()) {
            for (DocumentComment reply : comment.getReplies()) {
                resp.getReplies().add(DocumentCommentResponse.fromEntity(reply));
            }
        }
        resp.setCreatedAt(comment.getCreatedAt());
        resp.setUpdatedAt(comment.getUpdatedAt());
        return resp;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorEmail() {
        return authorEmail;
    }

    public void setAuthorEmail(String authorEmail) {
        this.authorEmail = authorEmail;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getAnchorText() {
        return anchorText;
    }

    public void setAnchorText(String anchorText) {
        this.anchorText = anchorText;
    }

    public boolean isResolved() {
        return isResolved;
    }

    public void setResolved(boolean resolved) {
        isResolved = resolved;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public List<DocumentCommentResponse> getReplies() {
        return replies;
    }

    public void setReplies(List<DocumentCommentResponse> replies) {
        this.replies = replies;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
