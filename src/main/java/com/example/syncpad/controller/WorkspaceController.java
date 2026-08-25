package com.example.syncpad.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.service.WorkspaceService;

@RestController
@RequestMapping("/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final com.example.syncpad.service.NotificationService notificationService;

    public WorkspaceController(WorkspaceService workspaceService, com.example.syncpad.service.NotificationService notificationService) {
        this.workspaceService = workspaceService;
        this.notificationService = notificationService;
    }

    public static class CreateWorkspaceRequest {
        private String name;
        private String description;
        private String color;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }

    public static class ShareWorkspaceRequest {
        private String email;
        private Role role;

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    @PostMapping
    public ResponseEntity<Workspace> createWorkspace(@RequestBody CreateWorkspaceRequest request, Authentication authentication) {
        Workspace workspace = workspaceService.createWorkspace(
                request.getName(),
                request.getDescription(),
                request.getColor(),
                authentication.getName()
        );
        return ResponseEntity.ok(workspace);
    }

    @GetMapping
    public ResponseEntity<List<Workspace>> getWorkspaces(Authentication authentication) {
        return ResponseEntity.ok(workspaceService.getUserWorkspaces(authentication.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Workspace> updateWorkspace(
            @PathVariable Long id,
            @RequestBody CreateWorkspaceRequest request,
            Authentication authentication
    ) {
        Workspace workspace = workspaceService.updateWorkspace(
                id, request.getName(), request.getDescription(), request.getColor(), authentication.getName()
        );
        return ResponseEntity.ok(workspace);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable Long id, Authentication authentication) {
        workspaceService.deleteWorkspace(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/invite")
    public ResponseEntity<com.example.syncpad.dto.response.NotificationResponse> inviteToWorkspace(
            @PathVariable Long id,
            @RequestBody ShareWorkspaceRequest request,
            Authentication authentication
    ) {
        com.example.syncpad.dto.response.NotificationResponse response = notificationService.sendWorkspaceInvite(
                id, authentication.getName(), request.getEmail(), request.getRole() != null ? request.getRole() : Role.EDITOR
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<WorkspacePermission> shareWorkspace(
            @PathVariable Long id,
            @RequestBody ShareWorkspaceRequest request,
            Authentication authentication
    ) {
        WorkspacePermission permission = workspaceService.shareWorkspace(
                id, authentication.getName(), request.getEmail(), request.getRole() != null ? request.getRole() : Role.EDITOR
        );
        return ResponseEntity.ok(permission);
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<WorkspacePermission>> getMembers(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(workspaceService.getWorkspaceMembers(id, authentication.getName()));
    }

    public static class UpdateRoleRequest {
        private Role role;
        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    @PutMapping("/{id}/members/{userId}/role")
    public ResponseEntity<WorkspacePermission> updateMemberRole(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody UpdateRoleRequest request,
            Authentication authentication
    ) {
        WorkspacePermission permission = workspaceService.updateMemberRole(
                id, userId, request.getRole(), authentication.getName()
        );
        return ResponseEntity.ok(permission);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId, Authentication authentication) {
        workspaceService.removeWorkspaceMember(id, userId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/recent-files")
    public ResponseEntity<List<Document>> getRecentFiles(@PathVariable Long id) {
        return ResponseEntity.ok(workspaceService.getWorkspaceRecentFiles(id));
    }
}
