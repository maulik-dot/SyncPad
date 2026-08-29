package com.example.syncpad.dto.request;

import com.example.syncpad.entity.Role;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ShareDocumentRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotNull(message = "Role is required")
    private Role role;

    private Integer durationHours;

    public ShareDocumentRequest() {
    }

    public ShareDocumentRequest(String email, Role role) {
        this(email, role, null);
    }

    public ShareDocumentRequest(String email, Role role, Integer durationHours) {
        this.email = email;
        this.role = role;
        this.durationHours = durationHours;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Integer getDurationHours() {
        return durationHours;
    }

    public void setDurationHours(Integer durationHours) {
        this.durationHours = durationHours;
    }
}
