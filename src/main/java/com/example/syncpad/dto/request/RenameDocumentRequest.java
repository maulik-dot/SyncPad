package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class RenameDocumentRequest {
    @NotBlank(message = "Title cannot be blank")
    private String title;

    public RenameDocumentRequest() {}

    public RenameDocumentRequest(String title) {
        this.title = title;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
