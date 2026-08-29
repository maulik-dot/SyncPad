package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class CreateWebhookRequest {

    @NotBlank(message = "Webhook name cannot be blank")
    private String name;

    @NotBlank(message = "Webhook destination URL cannot be blank")
    private String url;

    private String secret;
    private String events; // comma-separated or "*"

    public CreateWebhookRequest() {}

    public CreateWebhookRequest(String name, String url, String secret, String events) {
        this.name = name;
        this.url = url;
        this.secret = secret;
        this.events = events;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }

    public String getEvents() { return events; }
    public void setEvents(String events) { this.events = events; }
}
