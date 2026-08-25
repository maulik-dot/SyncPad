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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.request.ShareDocumentRequest;
import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.FolderPermission;
import com.example.syncpad.entity.Role;
import com.example.syncpad.service.FolderService;

@RestController
@RequestMapping("/folders")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    public static class CreateFolderRequest {
        private String name;
        private String workspaceName;
        private Long parentFolderId;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getWorkspaceName() { return workspaceName; }
        public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

        public Long getParentFolderId() { return parentFolderId; }
        public void setParentFolderId(Long parentFolderId) { this.parentFolderId = parentFolderId; }
    }

    public static class UpdateFolderPermissionRequest {
        private Long userId;
        private String email;
        private Role role;

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    @PostMapping
    public ResponseEntity<Folder> createFolder(@RequestBody CreateFolderRequest request, Authentication authentication) {
        Folder folder = folderService.createFolder(
                request.getName(),
                request.getWorkspaceName(),
                request.getParentFolderId(),
                authentication.getName()
        );
        return ResponseEntity.ok(folder);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Folder> updateFolder(
            @PathVariable Long id,
            @RequestBody CreateFolderRequest request,
            Authentication authentication
    ) {
        Folder folder = folderService.updateFolder(id, request.getName(), authentication.getName());
        return ResponseEntity.ok(folder);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable Long id, Authentication authentication) {
        folderService.deleteFolder(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Folder> getFolder(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(folderService.getFolder(id, authentication.getName()));
    }

    @GetMapping
    public ResponseEntity<List<Folder>> getFolders(
            @RequestParam(required = false) String workspace,
            Authentication authentication
    ) {
        String userEmail = (authentication != null) ? authentication.getName() : null;
        if (workspace != null && !workspace.isBlank()) {
            return ResponseEntity.ok(folderService.getFoldersByWorkspace(workspace, userEmail));
        }
        if (userEmail != null) {
            return ResponseEntity.ok(folderService.getUserFolders(userEmail));
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{id}/subfolders")
    public ResponseEntity<List<Folder>> getSubfolders(@PathVariable Long id) {
        return ResponseEntity.ok(folderService.getSubfolders(id));
    }

    @GetMapping("/{id}/permissions")
    public ResponseEntity<List<PermissionResponse>> getFolderPermissions(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(folderService.getFolderPermissions(id, authentication.getName()));
    }

    @PostMapping("/{id}/permissions")
    public ResponseEntity<PermissionResponse> updateFolderPermission(
            @PathVariable Long id,
            @RequestBody UpdateFolderPermissionRequest request,
            Authentication authentication
    ) {
        FolderPermission fp = folderService.updateFolderPermission(
                id,
                request.getUserId(),
                request.getEmail(),
                request.getRole(),
                authentication.getName()
        );
        if (fp == null) {
            return ResponseEntity.ok(new PermissionResponse(null, request.getUserId(), null, request.getEmail(), null));
        }
        return ResponseEntity.ok(new PermissionResponse(
                fp.getId(),
                fp.getUser().getId(),
                fp.getUser().getName(),
                fp.getUser().getEmail(),
                fp.getRole()
        ));
    }

    @DeleteMapping("/{id}/permissions/{userId}")
    public ResponseEntity<Void> removeFolderPermission(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication
    ) {
        folderService.removeFolderPermission(id, userId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
