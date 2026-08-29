package com.example.syncpad.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.syncpad.dto.request.CreateWebhookRequest;
import com.example.syncpad.dto.response.WebhookResponse;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Webhook;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WebhookRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@ExtendWith(MockitoExtension.class)
public class WebhookServiceTest {

    @Mock private WebhookRepository webhookRepository;
    @Mock private WorkspaceRepository workspaceRepository;
    @Mock private WorkspacePermissionRepository workspacePermissionRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;

    private WebhookService webhookService;

    private User admin;
    private Workspace workspace;

    @BeforeEach
    public void setup() {
        webhookService = new WebhookService(
                webhookRepository,
                workspaceRepository,
                workspacePermissionRepository,
                userRepository,
                auditLogService
        );

        admin = new User("Alice Admin", "alice@example.com", "hash");
        admin.setId(1L);

        workspace = new Workspace("Ops Workspace", "DevOps and Webhooks", "#10B981", "O", admin);
        workspace.setId(5L);
    }

    @Test
    public void testCreateWebhook_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(admin));
        when(workspaceRepository.findById(5L)).thenReturn(Optional.of(workspace));

        CreateWebhookRequest req = new CreateWebhookRequest(
                "Slack Integration",
                "https://hooks.slack.com/services/T00/B00/X00",
                "webhook_secret_key",
                "DOCUMENT_CREATED,COMMENT_ADDED"
        );

        when(webhookRepository.save(any(Webhook.class))).thenAnswer(inv -> {
            Webhook w = inv.getArgument(0);
            w.setId(10L);
            return w;
        });

        WebhookResponse res = webhookService.createWebhook(5L, req, "alice@example.com");
        assertNotNull(res);
        assertEquals(10L, res.getId());
        assertEquals("Slack Integration", res.getName());
        assertEquals("DOCUMENT_CREATED,COMMENT_ADDED", res.getEvents());
        verify(auditLogService).log(eq(admin), eq(workspace), any(), eq("WEBHOOK_CREATED"), anyString());
    }

    @Test
    public void testCreateWebhook_NonAdmin_ThrowsForbidden() {
        User member = new User("Bob Member", "bob@example.com", "hash");
        member.setId(2L);

        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(member));
        when(workspaceRepository.findById(5L)).thenReturn(Optional.of(workspace));
        when(workspacePermissionRepository.findByUserAndWorkspace(member, workspace))
                .thenReturn(Optional.of(new WorkspacePermission(workspace, member, Role.VIEWER)));

        CreateWebhookRequest req = new CreateWebhookRequest("Disallowed Hook", "https://example.com/hook", null, "*");
        assertThrows(PermissionDeniedException.class, () ->
                webhookService.createWebhook(5L, req, "bob@example.com"));
    }

    @Test
    public void testGetWorkspaceWebhooks_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(admin));
        when(workspaceRepository.findById(5L)).thenReturn(Optional.of(workspace));

        Webhook hook = new Webhook(workspace, "Discord Alerts", "https://discord.com/api/webhooks/123", null, "*");
        hook.setId(11L);

        when(webhookRepository.findByWorkspaceIdOrderByCreatedAtDesc(5L)).thenReturn(List.of(hook));

        List<WebhookResponse> hooks = webhookService.getWorkspaceWebhooks(5L, "alice@example.com");
        assertEquals(1, hooks.size());
        assertEquals("Discord Alerts", hooks.get(0).getName());
    }

    @Test
    public void testDeleteWebhook_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(admin));
        when(workspaceRepository.findById(5L)).thenReturn(Optional.of(workspace));

        Webhook hook = new Webhook(workspace, "Old Hook", "https://example.com/old", null, "*");
        hook.setId(12L);

        when(webhookRepository.findById(12L)).thenReturn(Optional.of(hook));

        webhookService.deleteWebhook(5L, 12L, "alice@example.com");
        verify(webhookRepository).delete(hook);
        verify(auditLogService).log(eq(admin), eq(workspace), any(), eq("WEBHOOK_DELETED"), anyString());
    }
}
