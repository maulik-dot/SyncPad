package com.example.syncpad.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "workspaces")
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;
    private String color;
    private String initial;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Workspace() {}

    public Workspace(String name, String description, String color, String initial, User owner) {
        this.name = name;
        this.description = description;
        this.color = color != null ? color : "#5b7fa6";
        this.initial = initial != null ? initial : (name.length() > 0 ? name.substring(0, 1).toUpperCase() : "W");
        this.owner = owner;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getInitial() { return initial; }
    public void setInitial(String initial) { this.initial = initial; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    @jakarta.persistence.Transient
    private Role currentUserRole;

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Role getCurrentUserRole() { return currentUserRole; }
    public void setCurrentUserRole(Role currentUserRole) { this.currentUserRole = currentUserRole; }
}
