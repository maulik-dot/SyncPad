package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

public class DocumentVersionResponse {
    private Long id;
    private Integer versionNumber;
    private String title;
    private String content;
    private String editedByEmail;
    private String editedByName;
    private LocalDateTime createdAt;

    public DocumentVersionResponse() {
    }

    public DocumentVersionResponse(Long id, Integer versionNumber, String title, String content, String editedByEmail, String editedByName, LocalDateTime createdAt) {
        this.id = id;
        this.versionNumber = versionNumber;
        this.title = title;
        this.content = content;
        this.editedByEmail = editedByEmail;
        this.editedByName = editedByName;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(Integer versionNumber) {
        this.versionNumber = versionNumber;
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

    public String getEditedByEmail() {
        return editedByEmail;
    }

    public void setEditedByEmail(String editedByEmail) {
        this.editedByEmail = editedByEmail;
    }

    public String getEditedByName() {
        return editedByName;
    }

    public void setEditedByName(String editedByName) {
        this.editedByName = editedByName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
