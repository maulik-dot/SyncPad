package com.example.syncpad.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.request.CreateWebhookRequest;
import com.example.syncpad.dto.response.WebhookResponse;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Webhook;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WebhookRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);

    private final WebhookRepository webhookRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public WebhookService(
            WebhookRepository webhookRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            UserRepository userRepository,
            AuditLogService auditLogService
    ) {
        this.webhookRepository = webhookRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    private Workspace getWorkspaceAndCheckAdmin(Long workspaceId, User user) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + workspaceId));

        boolean isOwner = workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId());
        boolean isAdmin = isOwner || workspacePermissionRepository.findByUserAndWorkspace(user, workspace)
                .map(p -> !p.isExpired() && (p.getRole() == Role.ADMIN || p.getRole() == Role.OWNER))
                .orElse(false);

        if (!isAdmin) {
            throw new PermissionDeniedException("Only workspace admins can manage webhooks");
        }
        return workspace;
    }

    @Transactional
    public WebhookResponse createWebhook(Long workspaceId, CreateWebhookRequest request, String userEmail) {
        User user = getUserByEmail(userEmail);
        Workspace workspace = getWorkspaceAndCheckAdmin(workspaceId, user);

        String events = request.getEvents();
        if (events == null || events.isBlank()) {
            events = "*";
        }

        Webhook webhook = new Webhook(
                workspace,
                request.getName().trim(),
                request.getUrl().trim(),
                request.getSecret() != null && !request.getSecret().isBlank() ? request.getSecret().trim() : null,
                events.trim()
        );

        Webhook saved = webhookRepository.save(webhook);
        if (auditLogService != null) {
            auditLogService.log(user, workspace, null, "WEBHOOK_CREATED", "Registered webhook: " + saved.getName());
        }
        return WebhookResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<WebhookResponse> getWorkspaceWebhooks(Long workspaceId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + workspaceId));

        boolean isOwner = workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId());
        boolean isMember = isOwner || workspacePermissionRepository.findByUserAndWorkspace(user, workspace)
                .map(p -> !p.isExpired()).orElse(false);

        if (!isMember) {
            throw new PermissionDeniedException("Access denied: You are not a member of this workspace");
        }

        return webhookRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId).stream()
                .map(WebhookResponse::fromEntity)
                .collect(Collectors.toList());
    }

    public List<WebhookResponse> getWebhooksForWorkspace(Long workspaceId, String userEmail) {
        return getWorkspaceWebhooks(workspaceId, userEmail);
    }

    public void sendTestPing(Long workspaceId, Long webhookId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Workspace workspace = getWorkspaceAndCheckAdmin(workspaceId, user);
        Webhook webhook = webhookRepository.findById(webhookId)
                .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        if (!webhook.getWorkspace().getId().equals(workspace.getId())) {
            throw new IllegalArgumentException("Webhook does not belong to the specified workspace");
        }
        dispatch(workspaceId, "WEBHOOK_PING", Map.of("message", "Test ping from SyncPad", "sender", user.getName()));
    }

    @Transactional
    public void deleteWebhook(Long workspaceId, Long webhookId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Workspace workspace = getWorkspaceAndCheckAdmin(workspaceId, user);

        Webhook webhook = webhookRepository.findById(webhookId)
                .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));

        if (!webhook.getWorkspace().getId().equals(workspace.getId())) {
            throw new IllegalArgumentException("Webhook does not belong to the specified workspace");
        }

        webhookRepository.delete(webhook);
        if (auditLogService != null) {
            auditLogService.log(user, workspace, null, "WEBHOOK_DELETED", "Deleted webhook #" + webhookId);
        }
    }

    public void dispatch(Long workspaceId, String eventType, Object payload) {
        if (workspaceId == null || eventType == null) return;

        CompletableFuture.runAsync(() -> {
            try {
                List<Webhook> activeHooks = webhookRepository.findByWorkspaceIdAndIsActiveTrue(workspaceId);
                if (activeHooks.isEmpty()) return;

                Map<String, Object> eventBody = Map.of(
                        "event", eventType,
                        "workspaceId", workspaceId,
                        "timestamp", LocalDateTime.now().toString(),
                        "deliveryId", UUID.randomUUID().toString(),
                        "data", payload != null ? payload : Map.of()
                );

                String jsonPayload = objectMapper.writeValueAsString(eventBody);

                for (Webhook hook : activeHooks) {
                    if (isSubscribed(hook.getEvents(), eventType)) {
                        sendNotification(hook, eventType, jsonPayload);
                    }
                }
            } catch (Exception e) {
                log.warn("Error preparing webhook dispatch for event {}: {}", eventType, e.getMessage());
            }
        });
    }

    private boolean isSubscribed(String registeredEvents, String eventType) {
        if (registeredEvents == null || registeredEvents.equals("*")) return true;
        for (String ev : registeredEvents.split(",")) {
            if (ev.trim().equalsIgnoreCase(eventType) || ev.trim().equals("*")) {
                return true;
            }
        }
        return false;
    }

    private void sendNotification(Webhook hook, String eventType, String jsonPayload) {
        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(hook.getUrl()))
                    .timeout(Duration.ofSeconds(4))
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "SyncPad-Webhooks/1.0")
                    .header("X-SyncPad-Event", eventType)
                    .header("X-SyncPad-Delivery", UUID.randomUUID().toString());

            if (hook.getSecret() != null && !hook.getSecret().isBlank()) {
                String signature = computeHmacSha256(jsonPayload, hook.getSecret());
                reqBuilder.header("X-SyncPad-Signature", "sha256=" + signature);
            }

            HttpRequest request = reqBuilder.POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8)).build();
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(res -> {
                        if (res.statusCode() >= 200 && res.statusCode() < 300) {
                            log.debug("Webhook {} delivered successfully: HTTP {}", hook.getName(), res.statusCode());
                        } else {
                            log.warn("Webhook {} delivered with HTTP status: {}", hook.getName(), res.statusCode());
                        }
                    })
                    .exceptionally(ex -> {
                        log.warn("Failed to deliver webhook {} to {}: {}", hook.getName(), hook.getUrl(), ex.getMessage());
                        return null;
                    });
        } catch (Exception e) {
            log.warn("Failed to prepare webhook request to {}: {}", hook.getUrl(), e.getMessage());
        }
    }

    private String computeHmacSha256(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : rawHmac) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
