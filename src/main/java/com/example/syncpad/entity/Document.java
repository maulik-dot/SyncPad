package com.example.syncpad.entity;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Version;

@Entity
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;
    private LocalDateTime createdAT;
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @ManyToOne
    @JoinColumn(name="owner_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "documents"})
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = true)
    private FileType fileType = FileType.DOC;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "owner", "parentFolder"})
    private Folder folder;

    @Column(name = "is_trashed", columnDefinition = "boolean default false")
    private boolean isTrashed = false;

    @Column(name = "trashed_at")
    private LocalDateTime trashedAt;

    @Column(name = "pdf_file_name")
    private String pdfFileName;

    @Column(name = "pdf_url")
    private String pdfUrl;

    @Column(name = "workspace_name")
    private String workspaceName;

    @jakarta.persistence.ManyToMany(fetch = FetchType.LAZY)
    @jakarta.persistence.JoinTable(
        name = "document_tags",
        joinColumns = @JoinColumn(name = "document_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private java.util.Set<Tag> tags = new java.util.HashSet<>();

    public Document(String title, String content, User owner) {
        this.title = title;
        this.content = content;
        this.owner = owner;
        this.fileType = FileType.DOC;
        this.createdAT = LocalDateTime.now();
    }

    public Document(String title, String content, FileType fileType, Folder folder, User owner) {
        this.title = title;
        this.content = content;
        this.fileType = fileType != null ? fileType : FileType.DOC;
        this.folder = folder;
        this.owner = owner;
        if (folder != null) {
            this.workspaceName = folder.getWorkspaceName();
        }
        this.createdAT = LocalDateTime.now();
    }

    public Document(String title, String content, FileType fileType, String workspaceName, Folder folder, User owner) {
        this.title = title;
        this.content = content;
        this.fileType = fileType != null ? fileType : FileType.DOC;
        this.workspaceName = workspaceName != null ? workspaceName : (folder != null ? folder.getWorkspaceName() : null);
        this.folder = folder;
        this.owner = owner;
        this.createdAT = LocalDateTime.now();
    }

    public FileType getFileType() { return fileType; }
    public void setFileType(FileType fileType) { this.fileType = fileType; }

    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public Document(){
        this.updatedAt=LocalDateTime.now();
    }

    public Long getId(){
        return this.id;
    }
    public void setId(Long id){
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public boolean isTrashed() { return isTrashed; }
    public void setTrashed(boolean trashed) { isTrashed = trashed; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getPdfFileName() { return pdfFileName; }
    public void setPdfFileName(String pdfFileName) { this.pdfFileName = pdfFileName; }

    public String getPdfUrl() { return pdfUrl; }
    public void setPdfUrl(String pdfUrl) { this.pdfUrl = pdfUrl; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

    public LocalDateTime getCreatedAt() { return createdAT; }
    public Long getVersion() { return version; }

    public LocalDateTime getTrashedAt() { return trashedAt; }
    public void setTrashedAt(LocalDateTime trashedAt) { this.trashedAt = trashedAt; }

    public java.util.Set<Tag> getTags() { return tags; }
    public void setTags(java.util.Set<Tag> tags) { this.tags = tags; }

    public void addTag(Tag tag) {
        if (this.tags == null) {
            this.tags = new java.util.HashSet<>();
        }
        this.tags.add(tag);
    }

    public void removeTag(Tag tag) {
        if (this.tags != null) {
            this.tags.remove(tag);
        }
    }
}
