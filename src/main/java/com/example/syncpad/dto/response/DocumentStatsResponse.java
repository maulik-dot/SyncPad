package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

public class DocumentStatsResponse {
    private Long documentId;
    private String title;
    private int wordCount;
    private int characterCount;
    private int paragraphCount;
    private int headingCount;
    private int readingTimeMinutes;
    private int versionCount;
    private int collaboratorCount;
    private String lastEditedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public DocumentStatsResponse() {}

    public DocumentStatsResponse(
            Long documentId,
            String title,
            int wordCount,
            int characterCount,
            int paragraphCount,
            int headingCount,
            int readingTimeMinutes,
            int versionCount,
            int collaboratorCount,
            String lastEditedBy,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.documentId = documentId;
        this.title = title;
        this.wordCount = wordCount;
        this.characterCount = characterCount;
        this.paragraphCount = paragraphCount;
        this.headingCount = headingCount;
        this.readingTimeMinutes = readingTimeMinutes;
        this.versionCount = versionCount;
        this.collaboratorCount = collaboratorCount;
        this.lastEditedBy = lastEditedBy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getWordCount() {
        return wordCount;
    }

    public void setWordCount(int wordCount) {
        this.wordCount = wordCount;
    }

    public int getCharacterCount() {
        return characterCount;
    }

    public void setCharacterCount(int characterCount) {
        this.characterCount = characterCount;
    }

    public int getParagraphCount() {
        return paragraphCount;
    }

    public void setParagraphCount(int paragraphCount) {
        this.paragraphCount = paragraphCount;
    }

    public int getHeadingCount() {
        return headingCount;
    }

    public void setHeadingCount(int headingCount) {
        this.headingCount = headingCount;
    }

    public int getReadingTimeMinutes() {
        return readingTimeMinutes;
    }

    public void setReadingTimeMinutes(int readingTimeMinutes) {
        this.readingTimeMinutes = readingTimeMinutes;
    }

    public int getVersionCount() {
        return versionCount;
    }

    public void setVersionCount(int versionCount) {
        this.versionCount = versionCount;
    }

    public int getCollaboratorCount() {
        return collaboratorCount;
    }

    public void setCollaboratorCount(int collaboratorCount) {
        this.collaboratorCount = collaboratorCount;
    }

    public String getLastEditedBy() {
        return lastEditedBy;
    }

    public void setLastEditedBy(String lastEditedBy) {
        this.lastEditedBy = lastEditedBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
