package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Role;

public class PermissionResponse {
    private Long id;
    private Long userId;
    private String userName;
    private String userEmail;
    private Role role;
    private LocalDateTime expiresAt;
    private boolean isExpired;

    public PermissionResponse() {
    }

    public PermissionResponse(Long id, Long userId, String userName, String userEmail, Role role) {
        this(id, userId, userName, userEmail, role, null);
    }

    public PermissionResponse(Long id, Long userId, String userName, String userEmail, Role role, LocalDateTime expiresAt) {
        this.id = id;
        this.userId = userId;
        this.userName = userName;
        this.userEmail = userEmail;
        this.role = role;
        this.expiresAt = expiresAt;
        this.isExpired = expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public boolean isExpired() { return isExpired; }
    public void setExpired(boolean expired) { isExpired = expired; }
}
