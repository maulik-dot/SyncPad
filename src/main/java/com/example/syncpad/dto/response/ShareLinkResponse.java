package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Role;

public class ShareLinkResponse {

    private Long id;
    private Long documentId;
    private String token;
    private String url;
    private Role role;
    private LocalDateTime expiresAt;
    private boolean active;

    public ShareLinkResponse() {}

    public ShareLinkResponse(Long id, Long documentId, String token, String url, Role role, LocalDateTime expiresAt, boolean active) {
        this.id = id;
        this.documentId = documentId;
        this.token = token;
        this.url = url;
        this.role = role;
        this.expiresAt = expiresAt;
        this.active = active;
    }

    public Long getId() { return id; }
    public Long getDocumentId() { return documentId; }
    public String getToken() { return token; }
    public String getUrl() { return url; }
    public Role getRole() { return role; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public boolean isActive() { return active; }
}
