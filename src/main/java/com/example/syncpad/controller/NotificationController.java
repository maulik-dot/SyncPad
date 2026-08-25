package com.example.syncpad.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.response.NotificationResponse;
import com.example.syncpad.service.NotificationService;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getUserNotifications(Authentication authentication) {
        return ResponseEntity.ok(notificationService.getUserNotifications(authentication.getName()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(Authentication authentication) {
        long count = notificationService.getUnreadCount(authentication.getName());
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(notificationService.markAsRead(id, authentication.getName()));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(Authentication authentication) {
        notificationService.markAllAsRead(authentication.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<NotificationResponse> acceptInvite(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(notificationService.acceptInvite(id, authentication.getName()));
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<NotificationResponse> declineInvite(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(notificationService.declineInvite(id, authentication.getName()));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id, Authentication authentication) {
        notificationService.deleteNotification(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/clear-all")
    public ResponseEntity<Void> clearAllNotifications(Authentication authentication) {
        notificationService.clearAllNotifications(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.DeleteMapping
    public ResponseEntity<Void> clearAll(Authentication authentication) {
        notificationService.clearAllNotifications(authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
