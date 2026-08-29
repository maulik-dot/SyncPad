package com.example.syncpad.security.secrets;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Fallback Secret Provider that resolves secrets from standard Environment variables.
 */
public class EnvironmentSecretProvider implements SecretProvider {

    @Override
    public String getSecret(String key) {
        String val = System.getenv(key);
        if (val == null) {
            val = System.getProperty(key);
        }
        return val;
    }

    @Override
    public Map<String, String> getAllSecrets() {
        return Collections.unmodifiableMap(new HashMap<>(System.getenv()));
    }

    @Override
    public String getProviderName() {
        return "Local Environment Variables (Fallback)";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }
}
