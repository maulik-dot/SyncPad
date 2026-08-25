package com.example.syncpad.dto.request;

import com.example.syncpad.entity.Role;

import jakarta.validation.constraints.NotNull;

public class CreateShareLinkRequest {

    @NotNull(message = "Role is required")
    private Role role;

    private Integer expiresInDays; // null or 0 means Never expire

    public CreateShareLinkRequest() {}

    public CreateShareLinkRequest(Role role, Integer expiresInDays) {
        this.role = role;
        this.expiresInDays = expiresInDays;
    }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Integer getExpiresInDays() { return expiresInDays; }
    public void setExpiresInDays(Integer expiresInDays) { this.expiresInDays = expiresInDays; }
}
