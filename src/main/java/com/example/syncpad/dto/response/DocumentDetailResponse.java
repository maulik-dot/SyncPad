package com.example.syncpad.dto.response;

import java.time.LocalDateTime;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.Role;

public class DocumentDetailResponse {
    private Long id;
    private String title;
    private String content;
    private FileType fileType;
    private Long folderId;
    private String folderName;
    private Long ownerId;
    private String ownerName;
    private String ownerEmail;
    private Role currentUserRole;
    private Long version;
    private boolean isTrashed;
    private DocumentStatsResponse stats;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public DocumentDetailResponse() {}

    public DocumentDetailResponse(
            Long id,
            String title,
            String content,
            FileType fileType,
            Long folderId,
            String folderName,
            Long ownerId,
            String ownerName,
            String ownerEmail,
            Role currentUserRole,
            Long version,
            boolean isTrashed,
            DocumentStatsResponse stats,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.fileType = fileType;
        this.folderId = folderId;
        this.folderName = folderName;
        this.ownerId = ownerId;
        this.ownerName = ownerName;
        this.ownerEmail = ownerEmail;
        this.currentUserRole = currentUserRole;
        this.version = version;
        this.isTrashed = isTrashed;
        this.stats = stats;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public FileType getFileType() {
        return fileType;
    }

    public void setFileType(FileType fileType) {
        this.fileType = fileType;
    }

    public Long getFolderId() {
        return folderId;
    }

    public void setFolderId(Long folderId) {
        this.folderId = folderId;
    }

    public String getFolderName() {
        return folderName;
    }

    public void setFolderName(String folderName) {
        this.folderName = folderName;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public Role getCurrentUserRole() {
        return currentUserRole;
    }

    public void setCurrentUserRole(Role currentUserRole) {
        this.currentUserRole = currentUserRole;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public boolean isTrashed() {
        return isTrashed;
    }

    public void setTrashed(boolean trashed) {
        isTrashed = trashed;
    }

    public DocumentStatsResponse getStats() {
        return stats;
    }

    public void setStats(DocumentStatsResponse stats) {
        this.stats = stats;
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
