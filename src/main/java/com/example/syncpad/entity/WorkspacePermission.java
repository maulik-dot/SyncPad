package com.example.syncpad.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;

@Entity
@Table(name = "workspace_permissions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"workspace_id", "user_id"})
})
public class WorkspacePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public WorkspacePermission() {}

    public WorkspacePermission(Workspace workspace, User user, Role role) {
        this.workspace = workspace;
        this.user = user;
        this.role = role;
    }

    public Long getId() { return id; }
    public Workspace getWorkspace() { return workspace; }
    public void setWorkspace(Workspace workspace) { this.workspace = workspace; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
