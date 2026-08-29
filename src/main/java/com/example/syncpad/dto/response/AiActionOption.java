package com.example.syncpad.dto.response;

import com.example.syncpad.entity.AiActionType;

public class AiActionOption {

    private AiActionType action;
    private String label;
    private String description;
    private String icon;
    private String defaultPrompt;

    public AiActionOption() {
    }

    public AiActionOption(AiActionType action, String label, String description, String icon, String defaultPrompt) {
        this.action = action;
        this.label = label;
        this.description = description;
        this.icon = icon;
        this.defaultPrompt = defaultPrompt;
    }

    public AiActionType getAction() {
        return action;
    }

    public void setAction(AiActionType action) {
        this.action = action;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getIcon() {
        return icon;
    }

    public void setIcon(String icon) {
        this.icon = icon;
    }

    public String getDefaultPrompt() {
        return defaultPrompt;
    }

    public void setDefaultPrompt(String defaultPrompt) {
        this.defaultPrompt = defaultPrompt;
    }
}

