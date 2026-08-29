package com.example.syncpad.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.request.CreateWebhookRequest;
import com.example.syncpad.dto.response.WebhookResponse;
import com.example.syncpad.service.WebhookService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/workspaces/{workspaceId}/webhooks")
public class WebhookController {

    private final WebhookService webhookService;

    public WebhookController(WebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping
    public ResponseEntity<WebhookResponse> createWebhook(
            @PathVariable Long workspaceId,
            @Valid @RequestBody CreateWebhookRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        WebhookResponse response = webhookService.createWebhook(workspaceId, request, userDetails.getUsername());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<WebhookResponse>> getWebhooks(
            @PathVariable Long workspaceId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<WebhookResponse> response = webhookService.getWebhooksForWorkspace(workspaceId, userDetails.getUsername());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{webhookId}")
    public ResponseEntity<Void> deleteWebhook(
            @PathVariable Long workspaceId,
            @PathVariable Long webhookId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        webhookService.deleteWebhook(workspaceId, webhookId, userDetails.getUsername());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{webhookId}/test")
    public ResponseEntity<Void> testWebhook(
            @PathVariable Long workspaceId,
            @PathVariable Long webhookId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        webhookService.sendTestPing(workspaceId, webhookId, userDetails.getUsername());
        return ResponseEntity.ok().build();
    }
}
