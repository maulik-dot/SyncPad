package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.DocumentTemplate;

public class TemplateResponse {
    private Long id;
    private String title;
    private String description;
    private String content;
    private String category;
    private String icon;
    private boolean isBuiltin;
    private Long workspaceId;
    private String creatorName;
    private LocalDateTime createdAt;

    public TemplateResponse() {}

    public TemplateResponse(Long id, String title, String description, String content,
                            String category, String icon, boolean isBuiltin,
                            Long workspaceId, String creatorName, LocalDateTime createdAt) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.content = content;
        this.category = category;
        this.icon = icon;
        this.isBuiltin = isBuiltin;
        this.workspaceId = workspaceId;
        this.creatorName = creatorName;
        this.createdAt = createdAt;
    }

    public static TemplateResponse fromEntity(DocumentTemplate template) {
        if (template == null) return null;
        Long wsId = template.getWorkspace() != null ? template.getWorkspace().getId() : null;
        String cName = template.getCreator() != null ? template.getCreator().getName() : "System Built-in";
        return new TemplateResponse(
                template.getId(),
                template.getTitle(),
                template.getDescription(),
                template.getContent(),
                template.getCategory(),
                template.getIcon(),
                template.isBuiltin(),
                wsId,
                cName,
                template.getCreatedAt()
        );
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getContent() { return content; }
    public String getCategory() { return category; }
    public String getIcon() { return icon; }
    public boolean isBuiltin() { return isBuiltin; }
    public Long getWorkspaceId() { return workspaceId; }
    public String getCreatorName() { return creatorName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
