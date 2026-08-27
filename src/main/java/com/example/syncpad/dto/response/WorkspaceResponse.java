package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.Workspace;

public class WorkspaceResponse {
    private Long id;
    private String name;
    private String description;
    private String color;
    private String initial;
    private Long ownerId;
    private String ownerName;
    private Role currentUserRole;
    private LocalDateTime createdAt;

    public WorkspaceResponse() {
    }

    public static WorkspaceResponse from(Workspace ws) {
        if (ws == null) return null;
        return from(ws, ws.getCurrentUserRole());
    }

    public static WorkspaceResponse from(Workspace ws, Role role) {
        if (ws == null) return null;
        WorkspaceResponse resp = new WorkspaceResponse();
        resp.setId(ws.getId());
        resp.setName(ws.getName());
        resp.setDescription(ws.getDescription());
        resp.setColor(ws.getColor());
        resp.setInitial(ws.getInitial());
        resp.setOwnerId(ws.getOwner() != null ? ws.getOwner().getId() : null);
        resp.setOwnerName(ws.getOwner() != null ? ws.getOwner().getName() : null);
        resp.setCurrentUserRole(role != null ? role : ws.getCurrentUserRole());
        resp.setCreatedAt(ws.getCreatedAt());
        return resp;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getInitial() { return initial; }
    public void setInitial(String initial) { this.initial = initial; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public Role getCurrentUserRole() { return currentUserRole; }
    public void setCurrentUserRole(Role currentUserRole) { this.currentUserRole = currentUserRole; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
