package com.example.syncpad.security.secrets;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.Ordered;

public class SecretProviderTest {

    @Test
    @DisplayName("EnvironmentSecretProvider should read existing environment variables")
    void testEnvironmentSecretProvider() {
        SecretProvider provider = new EnvironmentSecretProvider();
        assertTrue(provider.isAvailable());
        assertEquals("Local Environment Variables (Fallback)", provider.getProviderName());
        assertNotNull(provider.getAllSecrets());
    }

    @Test
    @DisplayName("AwsSecretsManagerProvider should report not available if secretId is blank")
    void testAwsSecretsManagerProviderUnavailable() {
        SecretProvider provider = new AwsSecretsManagerProvider("", "us-east-1");
        assertFalse(provider.isAvailable());
        assertNull(provider.getSecret("DB_PASS"));
    }

    @Test
    @DisplayName("GcpSecretManagerProvider should report not available if secretId is blank")
    void testGcpSecretManagerProviderUnavailable() {
        SecretProvider provider = new GcpSecretManagerProvider("my-project", null);
        assertFalse(provider.isAvailable());
        assertNull(provider.getSecret("DB_PASS"));
    }

    @Test
    @DisplayName("VaultSecretProvider should report unavailable for invalid or empty address")
    void testVaultSecretProviderUnavailable() {
        SecretProvider provider = new VaultSecretProvider("http://invalid-vault-host:9999", "dummy-token", "secret/data/syncpad");
        assertFalse(provider.isAvailable());
        assertNull(provider.getSecret("POSTGRES_PASSWORD"));
    }

    @Test
    @DisplayName("SecretApplicationContextInitializer should initialize with highest precedence")
    void testSecretApplicationContextInitializer() {
        SecretApplicationContextInitializer initializer = new SecretApplicationContextInitializer();
        GenericApplicationContext context = new GenericApplicationContext();

        initializer.initialize(context);

        assertEquals(Ordered.HIGHEST_PRECEDENCE, initializer.getOrder());
    }

    @Test
    @DisplayName("VaultSecretProvider resolves secrets against local Vault if accessible")
    void testVaultSecretProviderLive() {
        String vaultAddr = "http://127.0.0.1:8200";
        String vaultToken = "syncpad_root_vault_token_2026";
        VaultSecretProvider provider = new VaultSecretProvider(vaultAddr, vaultToken, "secret/data/syncpad");

        if (provider.isAvailable()) {
            Map<String, String> secrets = provider.getAllSecrets();
            assertNotNull(secrets);
            assertTrue(secrets.containsKey("POSTGRES_PASSWORD"));
            assertTrue(secrets.containsKey("JWT_SECRET"));
            assertEquals("syncpad_prod_password_2026_x7k9m", provider.getSecret("POSTGRES_PASSWORD"));
        }
    }
}
