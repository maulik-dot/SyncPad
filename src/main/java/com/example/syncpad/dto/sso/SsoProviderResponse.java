package com.example.syncpad.dto.sso;

public class SsoProviderResponse {

    private String domain;
    private String provider;
    private String displayName;
    private String singleSignOnUrl;
    private String issuerUrl;
    private boolean autoProvision;

    public SsoProviderResponse() {
    }

    public SsoProviderResponse(String domain, String provider, String displayName, String singleSignOnUrl, String issuerUrl, boolean autoProvision) {
        this.domain = domain;
        this.provider = provider;
        this.displayName = displayName;
        this.singleSignOnUrl = singleSignOnUrl;
        this.issuerUrl = issuerUrl;
        this.autoProvision = autoProvision;
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

    public String getSingleSignOnUrl() {
        return singleSignOnUrl;
    }

    public void setSingleSignOnUrl(String singleSignOnUrl) {
        this.singleSignOnUrl = singleSignOnUrl;
    }

    public String getIssuerUrl() {
        return issuerUrl;
    }

    public void setIssuerUrl(String issuerUrl) {
        this.issuerUrl = issuerUrl;
    }

    public boolean isAutoProvision() {
        return autoProvision;
    }

    public void setAutoProvision(boolean autoProvision) {
        this.autoProvision = autoProvision;
    }
}
