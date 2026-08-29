package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.AuditLog;

public class AuditLogResponse {
    private Long id;
    private Long userId;
    private String userName;
    private String userEmail;
    private Long workspaceId;
    private String workspaceName;
    private Long documentId;
    private String documentTitle;
    private String action;
    private String details;
    private LocalDateTime createdAt;

    public AuditLogResponse() {}

    public AuditLogResponse(Long id, Long userId, String userName, String userEmail, Long workspaceId,
                            String workspaceName, Long documentId, String documentTitle, String action,
                            String details, LocalDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.userName = userName;
        this.userEmail = userEmail;
        this.workspaceId = workspaceId;
        this.workspaceName = workspaceName;
        this.documentId = documentId;
        this.documentTitle = documentTitle;
        this.action = action;
        this.details = details;
        this.createdAt = createdAt;
    }

    public static AuditLogResponse fromEntity(AuditLog log) {
        if (log == null) return null;
        Long uid = log.getUser() != null ? log.getUser().getId() : null;
        Long wid = log.getWorkspace() != null ? log.getWorkspace().getId() : null;
        String wname = log.getWorkspace() != null ? log.getWorkspace().getName() : null;
        Long did = log.getDocument() != null ? log.getDocument().getId() : null;
        String dtitle = log.getDocument() != null ? log.getDocument().getTitle() : null;

        return new AuditLogResponse(
                log.getId(),
                uid,
                log.getUserName(),
                log.getUserEmail(),
                wid,
                wname,
                did,
                dtitle,
                log.getAction(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public String getUserEmail() { return userEmail; }
    public Long getWorkspaceId() { return workspaceId; }
    public String getWorkspaceName() { return workspaceName; }
    public Long getDocumentId() { return documentId; }
    public String getDocumentTitle() { return documentTitle; }
    public String getAction() { return action; }
    public String getDetails() { return details; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
