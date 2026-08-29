package com.example.syncpad.dto.sso;

import jakarta.validation.constraints.NotBlank;

public class SsoLoginRequest {

    @NotBlank(message = "Provider is required")
    private String provider; // OKTA, AZURE_AD, GOOGLE_WORKSPACE, SAML_GENERIC

    @NotBlank(message = "Email is required")
    private String email;

    private String name;

    private String department;

    private String idToken;

    private String assertion;

    private String ssoId;

    public SsoLoginRequest() {
    }

    public SsoLoginRequest(String provider, String email, String name) {
        this.provider = provider;
        this.email = email;
        this.name = name;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getIdToken() {
        return idToken;
    }

    public void setIdToken(String idToken) {
        this.idToken = idToken;
    }

    public String getAssertion() {
        return assertion;
    }

    public void setAssertion(String assertion) {
        this.assertion = assertion;
    }

    public String getSsoId() {
        return ssoId;
    }

    public void setSsoId(String ssoId) {
        this.ssoId = ssoId;
    }
}
