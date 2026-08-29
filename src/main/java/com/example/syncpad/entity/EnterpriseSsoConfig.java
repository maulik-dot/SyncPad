package com.example.syncpad.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "enterprise_sso_configs")
public class EnterpriseSsoConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String domain;

    @Column(nullable = false, length = 50)
    private String provider; // OKTA, AZURE_AD, GOOGLE_WORKSPACE, SAML_GENERIC

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "issuer_url", length = 1024)
    private String issuerUrl;

    @Column(name = "client_id")
    private String clientId;

    @Column(name = "client_secret")
    private String clientSecret;

    @Column(name = "single_sign_on_url", length = 1024)
    private String singleSignOnUrl;

    @Column(columnDefinition = "TEXT")
    private String certificate;

    @Column(name = "auto_provision")
    private Boolean autoProvision = true;

    @Column(name = "default_role", length = 50)
    private String defaultRole = "EDITOR";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public EnterpriseSsoConfig() {
    }

    public EnterpriseSsoConfig(String domain, String provider, String displayName, String issuerUrl, String clientId, String singleSignOnUrl) {
        this.domain = domain;
        this.provider = provider;
        this.displayName = displayName;
        this.issuerUrl = issuerUrl;
        this.clientId = clientId;
        this.singleSignOnUrl = singleSignOnUrl;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getIssuerUrl() {
        return issuerUrl;
    }

    public void setIssuerUrl(String issuerUrl) {
        this.issuerUrl = issuerUrl;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getSingleSignOnUrl() {
        return singleSignOnUrl;
    }

    public void setSingleSignOnUrl(String singleSignOnUrl) {
        this.singleSignOnUrl = singleSignOnUrl;
    }

    public String getCertificate() {
        return certificate;
    }

    public void setCertificate(String certificate) {
        this.certificate = certificate;
    }

    public Boolean getAutoProvision() {
        return autoProvision;
    }

    public void setAutoProvision(Boolean autoProvision) {
        this.autoProvision = autoProvision;
    }

    public String getDefaultRole() {
        return defaultRole;
    }

    public void setDefaultRole(String defaultRole) {
        this.defaultRole = defaultRole;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
