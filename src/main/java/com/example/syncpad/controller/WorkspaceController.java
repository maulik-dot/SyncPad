package com.example.syncpad.controller;

import java.util.List;
import java.util.stream.Collectors;

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

import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.dto.response.NotificationResponse;
import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.dto.response.WorkspaceResponse;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.service.NotificationService;
import com.example.syncpad.service.WorkspaceService;

@RestController
@RequestMapping("/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final NotificationService notificationService;

    public WorkspaceController(WorkspaceService workspaceService, NotificationService notificationService) {
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
    public ResponseEntity<WorkspaceResponse> createWorkspace(@RequestBody CreateWorkspaceRequest request, Authentication authentication) {
        Workspace workspace = workspaceService.createWorkspace(
                request.getName(),
                request.getDescription(),
                request.getColor(),
                authentication.getName()
        );
        return ResponseEntity.ok(WorkspaceResponse.from(workspace, Role.OWNER));
    }

    @GetMapping
    public ResponseEntity<List<WorkspaceResponse>> getWorkspaces(Authentication authentication) {
        List<Workspace> workspaces = workspaceService.getUserWorkspaces(authentication.getName());
        List<WorkspaceResponse> response = workspaces.stream()
                .map(ws -> {
                    Role role = workspaceService.getUserRoleInWorkspace(ws.getId(), authentication.getName());
                    return WorkspaceResponse.from(ws, role);
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<WorkspaceResponse> updateWorkspace(
            @PathVariable Long id,
            @RequestBody CreateWorkspaceRequest request,
            Authentication authentication
    ) {
        Workspace workspace = workspaceService.updateWorkspace(
                id, request.getName(), request.getDescription(), request.getColor(), authentication.getName()
        );
        Role role = workspaceService.getUserRoleInWorkspace(id, authentication.getName());
        return ResponseEntity.ok(WorkspaceResponse.from(workspace, role));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable Long id, Authentication authentication) {
        workspaceService.deleteWorkspace(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/invite")
    public ResponseEntity<NotificationResponse> inviteToWorkspace(
            @PathVariable Long id,
            @RequestBody ShareWorkspaceRequest request,
            Authentication authentication
    ) {
        NotificationResponse response = notificationService.sendWorkspaceInvite(
                id, authentication.getName(), request.getEmail(), request.getRole() != null ? request.getRole() : Role.EDITOR
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<PermissionResponse> shareWorkspace(
            @PathVariable Long id,
            @RequestBody ShareWorkspaceRequest request,
            Authentication authentication
    ) {
        WorkspacePermission permission = workspaceService.shareWorkspace(
                id, authentication.getName(), request.getEmail(), request.getRole() != null ? request.getRole() : Role.EDITOR
        );
        return ResponseEntity.ok(new PermissionResponse(
                permission.getId(),
                permission.getUser().getId(),
                permission.getUser().getEmail(),
                permission.getUser().getName(),
                permission.getRole()
        ));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<PermissionResponse>> getMembers(@PathVariable Long id, Authentication authentication) {
        List<WorkspacePermission> members = workspaceService.getWorkspaceMembers(id, authentication.getName());
        List<PermissionResponse> response = members.stream()
                .map(p -> new PermissionResponse(
                        p.getId(),
                        p.getUser().getId(),
                        p.getUser().getEmail(),
                        p.getUser().getName(),
                        p.getRole()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    public static class UpdateRoleRequest {
        private Role role;
        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    @PutMapping("/{id}/members/{userId}/role")
    public ResponseEntity<PermissionResponse> updateMemberRole(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody UpdateRoleRequest request,
            Authentication authentication
    ) {
        WorkspacePermission permission = workspaceService.updateMemberRole(
                id, userId, request.getRole(), authentication.getName()
        );
        return ResponseEntity.ok(new PermissionResponse(
                permission.getId(),
                permission.getUser().getId(),
                permission.getUser().getEmail(),
                permission.getUser().getName(),
                permission.getRole()
        ));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId, Authentication authentication) {
        workspaceService.removeWorkspaceMember(id, userId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/recent-files")
    public ResponseEntity<List<DocumentResponse>> getRecentFiles(@PathVariable Long id, Authentication authentication) {
        List<DocumentResponse> response = workspaceService.getWorkspaceRecentFiles(id, authentication.getName())
                .stream()
                .map(DocumentResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}
