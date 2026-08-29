package com.example.syncpad.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "templates")
public class DocumentTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    private String category; // e.g. "Engineering", "Product", "General"
    private String icon;     // Lucide icon name, e.g. "file-text", "code", "calendar"

    @Column(name = "is_builtin", nullable = false)
    private boolean isBuiltin = false;

    @ManyToOne
    @JoinColumn(name = "workspace_id")
    private Workspace workspace; // Nullable for system-wide builtins

    @ManyToOne
    @JoinColumn(name = "creator_id")
    private User creator;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public DocumentTemplate() {
    }

    public DocumentTemplate(String title, String description, String content, String category,
                            String icon, boolean isBuiltin, Workspace workspace, User creator) {
        this.title = title;
        this.description = description;
        this.content = content;
        this.category = category;
        this.icon = icon;
        this.isBuiltin = isBuiltin;
        this.workspace = workspace;
        this.creator = creator;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public boolean isBuiltin() { return isBuiltin; }
    public void setBuiltin(boolean builtin) { isBuiltin = builtin; }

    public Workspace getWorkspace() { return workspace; }
    public void setWorkspace(Workspace workspace) { this.workspace = workspace; }

    public User getCreator() { return creator; }
    public void setCreator(User creator) { this.creator = creator; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
