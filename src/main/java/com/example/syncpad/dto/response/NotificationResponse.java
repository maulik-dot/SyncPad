package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Notification;
import com.example.syncpad.entity.NotificationStatus;
import com.example.syncpad.entity.NotificationType;
import com.example.syncpad.entity.Role;

public class NotificationResponse {
    private Long id;
    private String senderName;
    private String senderEmail;
    private String recipientEmail;
    private Long workspaceId;
    private String workspaceName;
    private String workspaceInitial;
    private String workspaceColor;
    private NotificationType type;
    private String title;
    private String message;
    private Role targetRole;
    private NotificationStatus status;
    private boolean isRead;
    private LocalDateTime createdAt;

    public NotificationResponse() {}

    public static NotificationResponse fromEntity(Notification n) {
        NotificationResponse res = new NotificationResponse();
        res.setId(n.getId());
        if (n.getSender() != null) {
            res.setSenderName(n.getSender().getName());
            res.setSenderEmail(n.getSender().getEmail());
        }
        if (n.getRecipient() != null) {
            res.setRecipientEmail(n.getRecipient().getEmail());
        }
        if (n.getWorkspace() != null) {
            res.setWorkspaceId(n.getWorkspace().getId());
            res.setWorkspaceName(n.getWorkspace().getName());
            res.setWorkspaceInitial(n.getWorkspace().getInitial());
            res.setWorkspaceColor(n.getWorkspace().getColor());
        }
        res.setType(n.getType());
        res.setTitle(n.getTitle());
        res.setMessage(n.getMessage());
        res.setTargetRole(n.getTargetRole());
        res.setStatus(n.getStatus());
        res.setRead(n.isRead());
        res.setCreatedAt(n.getCreatedAt());
        return res;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderEmail() { return senderEmail; }
    public void setSenderEmail(String senderEmail) { this.senderEmail = senderEmail; }

    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }

    public Long getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(Long workspaceId) { this.workspaceId = workspaceId; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

    public String getWorkspaceInitial() { return workspaceInitial; }
    public void setWorkspaceInitial(String workspaceInitial) { this.workspaceInitial = workspaceInitial; }

    public String getWorkspaceColor() { return workspaceColor; }
    public void setWorkspaceColor(String workspaceColor) { this.workspaceColor = workspaceColor; }

    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Role getTargetRole() { return targetRole; }
    public void setTargetRole(Role targetRole) { this.targetRole = targetRole; }

    public NotificationStatus getStatus() { return status; }
    public void setStatus(NotificationStatus status) { this.status = status; }

    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
