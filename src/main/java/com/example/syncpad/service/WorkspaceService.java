package com.example.syncpad.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.NotificationResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Notification;
import com.example.syncpad.entity.NotificationStatus;
import com.example.syncpad.entity.NotificationType;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.NotificationRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public WorkspaceService(
            WorkspaceRepository workspaceRepository,
            UserRepository userRepository,
            DocumentRepository documentRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            NotificationRepository notificationRepository,
            SimpMessagingTemplate messagingTemplate,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder
    ) {
        this.workspaceRepository = workspaceRepository;
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    public boolean isUserAdmin(Workspace workspace, User user) {
        if (workspace == null || user == null) return false;
        if (workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId())) {
            return true;
        }
        return workspacePermissionRepository.findByUserAndWorkspace(user, workspace)
                .map(p -> p.getRole() == Role.OWNER || p.getRole() == Role.ADMIN)
                .orElse(false);
    }

    @Transactional
    public Workspace createWorkspace(String name, String description, String color, String userEmail) {
        User owner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        String initial = (name != null && name.length() > 0) ? name.substring(0, 1).toUpperCase() : "W";
        Workspace workspace = new Workspace(name, description, color, initial, owner);
        workspace.setCurrentUserRole(Role.OWNER);
        Workspace savedWorkspace = workspaceRepository.save(workspace);

        WorkspacePermission ownerPermission = new WorkspacePermission(savedWorkspace, owner, Role.OWNER);
        workspacePermissionRepository.save(ownerPermission);

        savedWorkspace.setCurrentUserRole(Role.OWNER);
        return savedWorkspace;
    }

    public List<Workspace> getUserWorkspaces(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        java.util.Map<Long, Workspace> map = new java.util.LinkedHashMap<>();

        List<Workspace> owned = workspaceRepository.findByOwnerId(user.getId());
        for (Workspace w : owned) {
            w.setCurrentUserRole(Role.OWNER);
            map.put(w.getId(), w);
        }

        List<WorkspacePermission> permissions = workspacePermissionRepository.findByUser(user);
        for (WorkspacePermission p : permissions) {
            Workspace w = p.getWorkspace();
            w.setCurrentUserRole(p.getRole());
            map.put(w.getId(), w);
        }

        return new java.util.ArrayList<>(map.values());
    }

    public Workspace getWorkspaceById(Long workspaceId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        var optPerm = workspacePermissionRepository.findByUserAndWorkspace(user, workspace);
        boolean isOwner = workspace.getOwner().getId().equals(user.getId());
        if (!isOwner && optPerm.isEmpty()) {
            throw new RuntimeException("Access denied to workspace: " + workspaceId);
        }

        workspace.setCurrentUserRole(isOwner ? Role.OWNER : optPerm.get().getRole());
        return workspace;
    }

    @Transactional
    public Workspace updateWorkspace(Long workspaceId, String name, String description, String color, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        if (!isUserAdmin(workspace, user)) {
            throw new PermissionDeniedException("Only Workspace Admin can edit workspace details");
        }

        if (name != null && !name.isBlank()) {
            workspace.setName(name);
            workspace.setInitial(name.substring(0, 1).toUpperCase());
        }
        if (description != null) workspace.setDescription(description);
        if (color != null) workspace.setColor(color);

        Workspace saved = workspaceRepository.save(workspace);
        saved.setCurrentUserRole(workspace.getOwner().getId().equals(user.getId()) ? Role.OWNER : Role.ADMIN);
        return saved;
    }

    @Transactional
    public void deleteWorkspace(Long workspaceId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        if (!isUserAdmin(workspace, user)) {
            throw new PermissionDeniedException("Only Workspace Admin can delete this workspace");
        }

        notificationRepository.deleteByWorkspace(workspace);
        List<WorkspacePermission> permissions = workspacePermissionRepository.findByWorkspace(workspace);
        workspacePermissionRepository.deleteAll(permissions);
        workspaceRepository.delete(workspace);
    }

    @Transactional
    public WorkspacePermission shareWorkspace(Long workspaceId, String ownerEmail, String targetEmail, Role role) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + ownerEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        if (!isUserAdmin(workspace, owner)) {
            throw new PermissionDeniedException("Only Workspace Admin can invite members");
        }

        User targetUser = userRepository.findByEmail(targetEmail)
                .orElseGet(() -> {
                    String name = targetEmail.contains("@") ? targetEmail.substring(0, targetEmail.indexOf('@')) : targetEmail;
                    if (name.length() > 0) {
                        name = Character.toUpperCase(name.charAt(0)) + name.substring(1);
                    }
                    User newUser = new User(name, targetEmail, passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
                    return userRepository.save(newUser);
                });

        WorkspacePermission permission = workspacePermissionRepository.findByUserAndWorkspace(targetUser, workspace)
                .orElseGet(() -> new WorkspacePermission(workspace, targetUser, role));

        permission.setRole(role);
        return workspacePermissionRepository.save(permission);
    }

    public List<WorkspacePermission> getWorkspaceMembers(Long workspaceId, String userEmail) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        return workspacePermissionRepository.findByWorkspace(workspace);
    }

    @Transactional
    public void removeWorkspaceMember(Long workspaceId, Long memberUserId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + requesterEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        boolean isAdmin = isUserAdmin(workspace, requester);
        boolean isSelfRemoval = memberUserId.equals(requester.getId());

        if (!isAdmin && !isSelfRemoval) {
            throw new PermissionDeniedException("Only Workspace Admin can remove other members");
        }

        User member = userRepository.findById(memberUserId)
                .orElseThrow(() -> new RuntimeException("Member user not found: " + memberUserId));

        if (workspace.getOwner().getId().equals(member.getId()) && !isSelfRemoval) {
            throw new PermissionDeniedException("Workspace Owner cannot be removed from workspace");
        }

        workspacePermissionRepository.findByUserAndWorkspace(member, workspace)
                .ifPresent(workspacePermissionRepository::delete);
    }

    @Transactional
    public WorkspacePermission updateMemberRole(Long workspaceId, Long memberUserId, Role newRole, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + requesterEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        if (!isUserAdmin(workspace, requester)) {
            throw new PermissionDeniedException("Only Workspace Admin can change member roles");
        }

        User member = userRepository.findById(memberUserId)
                .orElseThrow(() -> new RuntimeException("Member user not found: " + memberUserId));

        if (workspace.getOwner().getId().equals(member.getId()) && newRole != Role.OWNER) {
            throw new PermissionDeniedException("Cannot change Workspace Owner's role");
        }

        WorkspacePermission permission = workspacePermissionRepository.findByUserAndWorkspace(member, workspace)
                .orElseThrow(() -> new RuntimeException("User is not a member of this workspace"));

        permission.setRole(newRole);
        WorkspacePermission savedPermission = workspacePermissionRepository.save(permission);

        // Send notification to member
        if (!member.getId().equals(requester.getId())) {
            String title = newRole == Role.ADMIN ? "Promoted to Workspace Admin" : "Workspace Role Updated";
            String message = requester.getName() + (newRole == Role.ADMIN
                    ? " made you an Admin in '" + workspace.getName() + "'"
                    : " updated your role to " + (newRole == Role.EDITOR ? "an Editor" : "a Viewer") + " in '" + workspace.getName() + "'");

            Notification notification = new Notification(
                    member,
                    requester,
                    workspace,
                    NotificationType.ROLE_UPDATED,
                    title,
                    message,
                    newRole,
                    NotificationStatus.RESOLVED
            );
            notification.setRead(false);
            Notification savedNotification = notificationRepository.save(notification);

            try {
                messagingTemplate.convertAndSend("/topic/notifications/" + member.getEmail(), NotificationResponse.fromEntity(savedNotification));
            } catch (Exception e) {
                // WebSocket push optional
            }
        }

        return savedPermission;
    }

    public List<Document> getWorkspaceRecentFiles(Long workspaceId) {
        return documentRepository.findAll();
    }
}
