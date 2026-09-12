package com.example.syncpad.dto.response;

import com.example.syncpad.entity.AiActionType;

public class AiGenerateResponse {

    private String text;
    private AiActionType action;
    private String modelUsed;
    private int estimatedTokens;
    private long latencyMs;
    private boolean fallback;

    public AiGenerateResponse() {}

    public AiGenerateResponse(String text, AiActionType action, String modelUsed, int estimatedTokens, long latencyMs) {
        this(text, action, modelUsed, estimatedTokens, latencyMs, false);
    }

    public AiGenerateResponse(String text, AiActionType action, String modelUsed, int estimatedTokens, long latencyMs, boolean fallback) {
        this.text = text;
        this.action = action;
        this.modelUsed = modelUsed;
        this.estimatedTokens = estimatedTokens;
        this.latencyMs = latencyMs;
        this.fallback = fallback;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public AiActionType getAction() { return action; }
    public void setAction(AiActionType action) { this.action = action; }

    public String getModelUsed() { return modelUsed; }
    public void setModelUsed(String modelUsed) { this.modelUsed = modelUsed; }

    public int getEstimatedTokens() { return estimatedTokens; }
    public void setEstimatedTokens(int estimatedTokens) { this.estimatedTokens = estimatedTokens; }

    public long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(long latencyMs) { this.latencyMs = latencyMs; }

    public boolean isFallback() { return fallback; }
    public void setFallback(boolean fallback) { this.fallback = fallback; }
}
