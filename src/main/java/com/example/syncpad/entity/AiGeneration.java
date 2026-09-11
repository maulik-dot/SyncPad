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
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "ai_generations", indexes = {
        @Index(name = "idx_ai_generations_doc", columnList = "document_id, created_at DESC"),
        @Index(name = "idx_ai_generations_user", columnList = "user_id, created_at DESC"),
        @Index(name = "idx_ai_generations_created", columnList = "created_at DESC")
})
public class AiGeneration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "user_email")
    private String userEmail;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id")
    private Document document;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AiActionType action;

    @Column(name = "model_used", length = 100)
    private String modelUsed;

    @Column(columnDefinition = "TEXT")
    private String prompt;

    @Column(name = "selected_text", columnDefinition = "TEXT")
    private String selectedText;

    @Column(name = "response_text", columnDefinition = "TEXT")
    private String responseText;

    @Column(length = 50)
    private String tone;

    @Column(name = "estimated_tokens")
    private Integer estimatedTokens;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Column(name = "is_stream", nullable = false)
    private boolean isStream = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public AiGeneration() {}

    public AiGeneration(User user, String userEmail, Document document, AiActionType action,
                        String modelUsed, String prompt, String selectedText, String responseText,
                        String tone, Integer estimatedTokens, Long latencyMs, boolean isStream) {
        this.user = user;
        this.userEmail = userEmail != null ? userEmail : (user != null ? user.getEmail() : null);
        this.document = document;
        this.action = action;
        this.modelUsed = modelUsed;
        this.prompt = prompt;
        this.selectedText = selectedText;
        this.responseText = responseText;
        this.tone = tone;
        this.estimatedTokens = estimatedTokens;
        this.latencyMs = latencyMs;
        this.isStream = isStream;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }

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

    public boolean isStream() { return isStream; }
    public void setStream(boolean stream) { isStream = stream; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
