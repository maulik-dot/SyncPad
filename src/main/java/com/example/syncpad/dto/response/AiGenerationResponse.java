package com.example.syncpad.dto.response;

import java.time.LocalDateTime;

import com.example.syncpad.entity.AiActionType;
import com.example.syncpad.entity.AiGeneration;
import com.fasterxml.jackson.annotation.JsonProperty;

public class AiGenerationResponse {
    private Long id;
    private Long userId;
    private String userEmail;
    private Long documentId;
    private String documentTitle;
    private AiActionType action;
    private String modelUsed;
    private String prompt;
    private String selectedText;
    private String responseText;
    private String tone;
    private Integer estimatedTokens;
    private Long latencyMs;

    @JsonProperty("isStream")
    private boolean isStream;

    private LocalDateTime createdAt;

    public AiGenerationResponse() {}

    public AiGenerationResponse(Long id, Long userId, String userEmail, Long documentId,
                                String documentTitle, AiActionType action, String modelUsed,
                                String prompt, String selectedText, String responseText,
                                String tone, Integer estimatedTokens, Long latencyMs,
                                boolean isStream, LocalDateTime createdAt) {
        this.id = id;
        this.userId = userId;
        this.userEmail = userEmail;
        this.documentId = documentId;
        this.documentTitle = documentTitle;
        this.action = action;
        this.modelUsed = modelUsed;
        this.prompt = prompt;
        this.selectedText = selectedText;
        this.responseText = responseText;
        this.tone = tone;
        this.estimatedTokens = estimatedTokens;
        this.latencyMs = latencyMs;
        this.isStream = isStream;
        this.createdAt = createdAt;
    }

    public static AiGenerationResponse fromEntity(AiGeneration entity) {
        if (entity == null) return null;
        Long uid = entity.getUser() != null ? entity.getUser().getId() : null;
        Long docId = entity.getDocument() != null ? entity.getDocument().getId() : null;
        String docTitle = entity.getDocument() != null ? entity.getDocument().getTitle() : null;

        return new AiGenerationResponse(
                entity.getId(),
                uid,
                entity.getUserEmail(),
                docId,
                docTitle,
                entity.getAction(),
                entity.getModelUsed(),
                entity.getPrompt(),
                entity.getSelectedText(),
                entity.getResponseText(),
                entity.getTone(),
                entity.getEstimatedTokens(),
                entity.getLatencyMs(),
                entity.isStream(),
                entity.getCreatedAt()
        );
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }

    public String getDocumentTitle() { return documentTitle; }
    public void setDocumentTitle(String documentTitle) { this.documentTitle = documentTitle; }

    public AiActionType getAction() { return action; }
    public void setAction(AiActionType action) { this.action = action; }

    public String getModelUsed() { return modelUsed; }
    public void setModelUsed(String modelUsed) { this.modelUsed = modelUsed; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getSelectedText() { return selectedText; }
    public void setSelectedText(String selectedText) { this.selectedText = selectedText; }

    public String getResponseText() { return responseText; }
    public void setResponseText(String responseText) { this.responseText = responseText; }

    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }

    public Integer getEstimatedTokens() { return estimatedTokens; }
    public void setEstimatedTokens(Integer estimatedTokens) { this.estimatedTokens = estimatedTokens; }

    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }

    @JsonProperty("isStream")
    public boolean isStream() { return isStream; }

    public void setStream(boolean stream) { isStream = stream; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
