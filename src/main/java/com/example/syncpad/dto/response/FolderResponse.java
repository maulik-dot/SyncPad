package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Folder;

public class FolderResponse {
    private Long id;
    private String name;
    private String workspaceName;
    private Long parentFolderId;
    private Long ownerId;
    private String ownerName;
    private LocalDateTime createdAt;

    public FolderResponse() {
    }

    public static FolderResponse from(Folder folder) {
        if (folder == null) return null;
        FolderResponse resp = new FolderResponse();
        resp.setId(folder.getId());
        resp.setName(folder.getName());
        resp.setWorkspaceName(folder.getWorkspaceName());
        resp.setParentFolderId(folder.getParentFolder() != null ? folder.getParentFolder().getId() : null);
        resp.setOwnerId(folder.getOwner() != null ? folder.getOwner().getId() : null);
        resp.setOwnerName(folder.getOwner() != null ? folder.getOwner().getName() : null);
        resp.setCreatedAt(folder.getCreatedAt());
        return resp;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

    public Long getParentFolderId() { return parentFolderId; }
    public void setParentFolderId(Long parentFolderId) { this.parentFolderId = parentFolderId; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
