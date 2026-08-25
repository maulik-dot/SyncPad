package com.example.syncpad.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.NotificationResponse;
import com.example.syncpad.entity.Notification;
import com.example.syncpad.entity.NotificationStatus;
import com.example.syncpad.entity.NotificationType;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.NotificationRepository;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PasswordEncoder passwordEncoder;

    public NotificationService(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            SimpMessagingTemplate messagingTemplate,
            PasswordEncoder passwordEncoder
    ) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.messagingTemplate = messagingTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    public List<NotificationResponse> getUserNotifications(String userEmail) {
        return notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(userEmail)
                .stream()
                .map(NotificationResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(String userEmail) {
        return notificationRepository.countByRecipientEmailAndIsReadFalse(userEmail);
    }

    @Transactional
    public NotificationResponse markAsRead(Long id, String userEmail) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found: " + id));

        if (!notification.getRecipient().getEmail().equals(userEmail)) {
            throw new PermissionDeniedException("Unauthorized to modify this notification");
        }

        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        return NotificationResponse.fromEntity(saved);
    }

    @Transactional
    public void markAllAsRead(String userEmail) {
        List<Notification> list = notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(userEmail);
        for (Notification n : list) {
            if (!n.isRead()) {
                n.setRead(true);
            }
        }
        notificationRepository.saveAll(list);
    }

    @Transactional
    public NotificationResponse sendWorkspaceInvite(Long workspaceId, String inviterEmail, String targetEmail, Role role) {
        User inviter = userRepository.findByEmail(inviterEmail)
                .orElseThrow(() -> new RuntimeException("Inviter not found: " + inviterEmail));

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new RuntimeException("Workspace not found: " + workspaceId));

        boolean isOwner = workspace.getOwner().getId().equals(inviter.getId());
        boolean isAdmin = isOwner || workspacePermissionRepository.findByUserAndWorkspace(inviter, workspace)
                .map(p -> p.getRole() == Role.OWNER || p.getRole() == Role.ADMIN)
                .orElse(false);

        if (!isAdmin) {
            throw new PermissionDeniedException("Only Workspace Admin can invite members");
        }

        User targetUser = userRepository.findByEmail(targetEmail)
                .orElseGet(() -> {
                    String name = targetEmail.contains("@") ? targetEmail.substring(0, targetEmail.indexOf('@')) : targetEmail;
                    if (name.length() > 0) {
                        name = Character.toUpperCase(name.charAt(0)) + name.substring(1);
                    }
                    User newUser = new User(name, targetEmail, passwordEncoder.encode(UUID.randomUUID().toString()));
                    return userRepository.save(newUser);
                });

        if (workspacePermissionRepository.findByUserAndWorkspace(targetUser, workspace).isPresent()) {
            throw new RuntimeException("User " + targetEmail + " is already a member of this workspace");
        }

        String roleStr = role == Role.ADMIN ? "an Admin" : (role == Role.EDITOR ? "an Editor" : "a Viewer");

        // Check if there is already a PENDING invite
        Notification notification = notificationRepository.findByWorkspaceAndRecipientAndStatus(
                workspace, targetUser, NotificationStatus.PENDING
        ).orElseGet(() -> new Notification(
                targetUser,
                inviter,
                workspace,
                NotificationType.WORKSPACE_INVITE,
                "Workspace Invitation",
                inviter.getName() + " invited you to join '" + workspace.getName() + "' as " + roleStr,
                role,
                NotificationStatus.PENDING
        ));

        notification.setTargetRole(role);
        notification.setMessage(inviter.getName() + " invited you to join '" + workspace.getName() + "' as " + roleStr);
        notification.setRead(false);
        Notification saved = notificationRepository.save(notification);

        NotificationResponse response = NotificationResponse.fromEntity(saved);

        // Push real-time notification over WebSockets
        try {
            messagingTemplate.convertAndSend("/topic/notifications/" + targetUser.getEmail(), response);
        } catch (Exception e) {
            // WebSocket push optional if client offline
        }

        return response;
    }

    @Transactional
    public NotificationResponse acceptInvite(Long notificationId, String userEmail) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found: " + notificationId));

        if (!notification.getRecipient().getEmail().equals(userEmail)) {
            throw new PermissionDeniedException("Unauthorized to accept this invitation");
        }

        if (notification.getType() != NotificationType.WORKSPACE_INVITE) {
            throw new RuntimeException("Notification is not a workspace invitation");
        }

        if (notification.getStatus() != NotificationStatus.PENDING) {
            throw new RuntimeException("Invitation has already been " + notification.getStatus().name().toLowerCase());
        }

        Workspace workspace = notification.getWorkspace();
        User recipient = notification.getRecipient();
        Role role = notification.getTargetRole() != null ? notification.getTargetRole() : Role.EDITOR;

        // Grant workspace permission
        WorkspacePermission permission = workspacePermissionRepository.findByUserAndWorkspace(recipient, workspace)
                .orElseGet(() -> new WorkspacePermission(workspace, recipient, role));
        permission.setRole(role);
        workspacePermissionRepository.save(permission);

        // Update current notification
        notification.setStatus(NotificationStatus.ACCEPTED);
        notification.setRead(true);
        Notification savedNotification = notificationRepository.save(notification);

        // Notify the original inviter (sender)
        if (notification.getSender() != null) {
            Notification acceptanceNotification = new Notification(
                    notification.getSender(),
                    recipient,
                    workspace,
                    NotificationType.INVITE_ACCEPTED,
                    "Invitation Accepted",
                    recipient.getName() + " accepted your invitation to join '" + workspace.getName() + "'",
                    role,
                    NotificationStatus.RESOLVED
            );
            Notification savedAcceptance = notificationRepository.save(acceptanceNotification);
            NotificationResponse acceptanceResponse = NotificationResponse.fromEntity(savedAcceptance);

            try {
                messagingTemplate.convertAndSend("/topic/notifications/" + notification.getSender().getEmail(), acceptanceResponse);
            } catch (Exception e) {
                // WebSocket push
            }
        }

        return NotificationResponse.fromEntity(savedNotification);
    }

    @Transactional
    public NotificationResponse declineInvite(Long notificationId, String userEmail) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found: " + notificationId));

        if (!notification.getRecipient().getEmail().equals(userEmail)) {
            throw new PermissionDeniedException("Unauthorized to decline this invitation");
        }

        if (notification.getType() != NotificationType.WORKSPACE_INVITE) {
            throw new RuntimeException("Notification is not a workspace invitation");
        }

        if (notification.getStatus() != NotificationStatus.PENDING) {
            throw new RuntimeException("Invitation has already been " + notification.getStatus().name().toLowerCase());
        }

        notification.setStatus(NotificationStatus.DECLINED);
        notification.setRead(true);
        Notification savedNotification = notificationRepository.save(notification);

        // Notify the original inviter (sender)
        if (notification.getSender() != null) {
            Notification declinationNotification = new Notification(
                    notification.getSender(),
                    notification.getRecipient(),
                    notification.getWorkspace(),
                    NotificationType.INVITE_DECLINED,
                    "Invitation Declined",
                    notification.getRecipient().getName() + " declined your invitation to join '" + (notification.getWorkspace() != null ? notification.getWorkspace().getName() : "workspace") + "'",
                    notification.getTargetRole(),
                    NotificationStatus.RESOLVED
            );
            Notification savedDeclination = notificationRepository.save(declinationNotification);
            NotificationResponse declinationResponse = NotificationResponse.fromEntity(savedDeclination);

            try {
                messagingTemplate.convertAndSend("/topic/notifications/" + notification.getSender().getEmail(), declinationResponse);
            } catch (Exception e) {
                // WebSocket push
            }
        }

        return NotificationResponse.fromEntity(savedNotification);
    }

    @Transactional
    public void deleteNotification(Long id, String userEmail) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found: " + id));

        if (!notification.getRecipient().getEmail().equals(userEmail)) {
            throw new PermissionDeniedException("Unauthorized to delete this notification");
        }

        notificationRepository.delete(notification);
    }

    @Transactional
    public void clearAllNotifications(String userEmail) {
        notificationRepository.deleteByRecipientEmail(userEmail);
    }
}
