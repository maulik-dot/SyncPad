package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;

public class DocumentResponse {
    private Long id;
    private String title;
    private String content;
    private FileType fileType;
    private Long folderId;
    private String workspaceName;
    private Long ownerId;
    private String ownerName;
    private Long version;
    private boolean isTrashed;
    private String pdfFileName;
    private String pdfUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public DocumentResponse() {
    }

    public static DocumentResponse from(Document doc) {
        if (doc == null) return null;
        DocumentResponse resp = new DocumentResponse();
        resp.setId(doc.getId());
        resp.setTitle(doc.getTitle());
        resp.setContent(doc.getContent());
        resp.setFileType(doc.getFileType());
        resp.setFolderId(doc.getFolder() != null ? doc.getFolder().getId() : null);
        resp.setWorkspaceName(doc.getWorkspaceName());
        resp.setOwnerId(doc.getOwner() != null ? doc.getOwner().getId() : null);
        resp.setOwnerName(doc.getOwner() != null ? doc.getOwner().getName() : null);
        resp.setVersion(doc.getVersion());
        resp.setTrashed(doc.isTrashed());
        resp.setPdfFileName(doc.getPdfFileName());
        resp.setPdfUrl(doc.getPdfUrl());
        resp.setCreatedAt(doc.getCreatedAt());
        resp.setUpdatedAt(doc.getUpdatedAt());
        return resp;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public FileType getFileType() { return fileType; }
    public void setFileType(FileType fileType) { this.fileType = fileType; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public boolean isTrashed() { return isTrashed; }
    public void setTrashed(boolean trashed) { isTrashed = trashed; }

    public String getPdfFileName() { return pdfFileName; }
    public void setPdfFileName(String pdfFileName) { this.pdfFileName = pdfFileName; }

    public String getPdfUrl() { return pdfUrl; }
    public void setPdfUrl(String pdfUrl) { this.pdfUrl = pdfUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
