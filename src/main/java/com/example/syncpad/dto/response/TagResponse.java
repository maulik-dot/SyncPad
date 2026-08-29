package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Tag;

public class TagResponse {
    private Long id;
    private String name;
    private String color;
    private Long workspaceId;
    private LocalDateTime createdAt;

    public TagResponse() {}

    public TagResponse(Long id, String name, String color, Long workspaceId, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.workspaceId = workspaceId;
        this.createdAt = createdAt;
    }

    public static TagResponse from(Tag tag) {
        if (tag == null) return null;
        Long wsId = tag.getWorkspace() != null ? tag.getWorkspace().getId() : null;
        return new TagResponse(tag.getId(), tag.getName(), tag.getColor(), wsId, tag.getCreatedAt());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public Long getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(Long workspaceId) { this.workspaceId = workspaceId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}