package com.example.syncpad.security.secrets;

import java.util.Map;

/**
 * Common interface for secret providers (Vault, AWS Secrets Manager, GCP Secret Manager).
 */
public interface SecretProvider {

    String getSecret(String key);

    Map<String, String> getAllSecrets();

    String getProviderName();

    boolean isAvailable();
}
