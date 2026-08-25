package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateCommentRequest {

    @NotBlank(message = "Comment text is required")
    private String text;

    private String anchorText;

    private Long parentId;

    public CreateCommentRequest() {}

    public CreateCommentRequest(String text, String anchorText, Long parentId) {
        this.text = text;
        this.anchorText = anchorText;
        this.parentId = parentId;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getAnchorText() {
        return anchorText;
    }

    public void setAnchorText(String anchorText) {
        this.anchorText = anchorText;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }
}
