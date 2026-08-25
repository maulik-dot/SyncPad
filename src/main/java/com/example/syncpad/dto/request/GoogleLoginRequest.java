package com.example.syncpad.dto.request;

import jakarta.validation.constraints.NotBlank;

public class GoogleLoginRequest {

    @NotBlank(message = "Google ID Token is required")
    private String idToken;

    private String email;
    private String name;
    private String googleSub;

    public GoogleLoginRequest() {}

    public GoogleLoginRequest(String idToken) {
        this.idToken = idToken;
    }

    public GoogleLoginRequest(String idToken, String email, String name, String googleSub) {
        this.idToken = idToken;
        this.email = email;
        this.name = name;
        this.googleSub = googleSub;
    }

    public String getIdToken() { return idToken; }
    public void setIdToken(String idToken) { this.idToken = idToken; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getGoogleSub() { return googleSub; }
    public void setGoogleSub(String googleSub) { this.googleSub = googleSub; }
}
