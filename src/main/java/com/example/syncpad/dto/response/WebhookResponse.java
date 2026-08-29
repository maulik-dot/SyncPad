package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Webhook;

public class WebhookResponse {
    private Long id;
    private Long workspaceId;
    private String name;
    private String url;
    private String events;
    private boolean isActive;
    private LocalDateTime createdAt;

    public WebhookResponse() {}

    public WebhookResponse(Long id, Long workspaceId, String name, String url, String events,
                           boolean isActive, LocalDateTime createdAt) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.name = name;
        this.url = url;
        this.events = events;
        this.isActive = isActive;
        this.createdAt = createdAt;
    }

    public static WebhookResponse fromEntity(Webhook webhook) {
        if (webhook == null) return null;
        Long wsId = webhook.getWorkspace() != null ? webhook.getWorkspace().getId() : null;
        return new WebhookResponse(
                webhook.getId(),
                wsId,
                webhook.getName(),
                webhook.getUrl(),
                webhook.getEvents(),
                webhook.isActive(),
                webhook.getCreatedAt()
        );
    }

    public Long getId() { return id; }
    public Long getWorkspaceId() { return workspaceId; }
    public String getName() { return name; }
    public String getUrl() { return url; }
    public String getEvents() { return events; }
    public boolean isActive() { return isActive; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
