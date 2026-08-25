package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateDocumentRequest {
    @NotBlank(message = "Title is required")
    private String title;

    private String content;

    private String fileType;
    private Long folderId;
    private String workspaceName;

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public String getWorkspaceName() { return workspaceName; }
    public void setWorkspaceName(String workspaceName) { this.workspaceName = workspaceName; }

    public CreateDocumentRequest() {
    }

    public CreateDocumentRequest(String title, String content) {
        this.title = title;
        this.content = content;
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
}
