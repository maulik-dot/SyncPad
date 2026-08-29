package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateTemplateRequest {

    @NotBlank(message = "Template title cannot be blank")
    private String title;

    private String description;

    @NotBlank(message = "Template content cannot be blank")
    private String content;

    private String category;
    private String icon;
    private Long workspaceId;

    public CreateTemplateRequest() {}

    public CreateTemplateRequest(String title, String description, String content, String category, String icon, Long workspaceId) {
        this.title = title;
        this.description = description;
        this.content = content;
        this.category = category;
        this.icon = icon;
        this.workspaceId = workspaceId;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public Long getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(Long workspaceId) { this.workspaceId = workspaceId; }
}
