-- ==============================================================================
-- Migration V9: Enterprise Single Sign-On (SSO) & SCIM 2.0 Schema
-- ==============================================================================

-- 1. Extend users table for enterprise lifecycle and directory sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_domain VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);

-- Ensure all existing users are marked active
UPDATE users SET active = TRUE WHERE active IS NULL;

-- 2. Create enterprise_sso_configs table
CREATE TABLE IF NOT EXISTS enterprise_sso_configs (
    id BIGSERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL, -- OKTA, AZURE_AD, GOOGLE_WORKSPACE, SAML_GENERIC
    display_name VARCHAR(255) NOT NULL,
    issuer_url VARCHAR(1024),
    client_id VARCHAR(255),
    client_secret VARCHAR(255),
    single_sign_on_url VARCHAR(1024),
    certificate TEXT,
    auto_provision BOOLEAN DEFAULT TRUE,
    default_role VARCHAR(50) DEFAULT 'EDITOR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enterprise_sso_domain ON enterprise_sso_configs(domain);

-- 3. Seed default enterprise IdP domain configurations for test & production templates
INSERT INTO enterprise_sso_configs (domain, provider, display_name, issuer_url, client_id, single_sign_on_url, auto_provision, default_role)
VALUES 
    ('okta.com', 'OKTA', 'Okta Workforce Identity', 'https://dev-syncpad.okta.com/oauth2/default', 'okta_client_syncpad_01', 'https://dev-syncpad.okta.com/app/syncpad/sso/saml', TRUE, 'EDITOR'),
    ('microsoft.com', 'AZURE_AD', 'Microsoft Entra ID', 'https://login.microsoftonline.com/common/v2.0', 'azure_client_syncpad_01', 'https://login.microsoftonline.com/common/saml2', TRUE, 'EDITOR'),
    ('google.com', 'GOOGLE_WORKSPACE', 'Google Workspace Enterprise', 'https://accounts.google.com', 'google_client_syncpad_01', 'https://accounts.google.com/o/saml2/initsso', TRUE, 'EDITOR'),
    ('syncpad.test', 'OKTA', 'SyncPad Test Enterprise IdP', 'https://idp.syncpad.test/oauth2', 'test_client_syncpad_01', 'https://idp.syncpad.test/sso/saml', TRUE, 'EDITOR');

