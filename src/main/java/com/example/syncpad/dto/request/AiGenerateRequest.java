package com.example.syncpad.dto.request;

import com.example.syncpad.entity.AiActionType;
import jakarta.validation.constraints.NotNull;

public class AiGenerateRequest {

    private Long documentId;
    private String prompt;
    private String selectedText;

    @NotNull(message = "Action type is required")
    private AiActionType action = AiActionType.CUSTOM;

    private String targetLanguage;
    private String tone;
    private String language; // for CODE actions: e.g., javascript, python
    private Integer selectionLength; // for length-aware token budgeting

    public AiGenerateRequest() {}

    public AiGenerateRequest(Long documentId, String prompt, String selectedText, AiActionType action) {
        this.documentId = documentId;
        this.prompt = prompt;
        this.selectedText = selectedText;
        this.action = (action != null) ? action : AiActionType.CUSTOM;
    }

    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getSelectedText() { return selectedText; }
    public void setSelectedText(String selectedText) { this.selectedText = selectedText; }

    public AiActionType getAction() { return action; }
    public void setAction(AiActionType action) { this.action = action; }

    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }

    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Integer getSelectionLength() { return selectionLength; }
    public void setSelectionLength(Integer selectionLength) { this.selectionLength = selectionLength; }
}
