package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.Role;

public class SharedDocumentResponse {
    private Long id;
    private String title;
    private String content;
    private FileType fileType;
    private Role role;
    private String pdfUrl;
    private String pdfFileName;
    private LocalDateTime updatedAt;

    public SharedDocumentResponse() {
    }

    public SharedDocumentResponse(Long id, String title, String content, FileType fileType, Role role, String pdfUrl, String pdfFileName, LocalDateTime updatedAt) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.fileType = fileType;
        this.role = role;
        this.pdfUrl = pdfUrl;
        this.pdfFileName = pdfFileName;
        this.updatedAt = updatedAt;
    }

    public static SharedDocumentResponse fromEntity(Document doc, Role role) {
        if (doc == null) {
            return null;
        }
        return new SharedDocumentResponse(
                doc.getId(),
                doc.getTitle(),
                doc.getContent(),
                doc.getFileType(),
                role,
                doc.getPdfUrl(),
                doc.getPdfFileName(),
                doc.getUpdatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
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

    public FileType getFileType() {
        return fileType;
    }

    public void setFileType(FileType fileType) {
        this.fileType = fileType;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getPdfUrl() {
        return pdfUrl;
    }

    public void setPdfUrl(String pdfUrl) {
        this.pdfUrl = pdfUrl;
    }

    public String getPdfFileName() {
        return pdfFileName;
    }

    public void setPdfFileName(String pdfFileName) {
        this.pdfFileName = pdfFileName;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
