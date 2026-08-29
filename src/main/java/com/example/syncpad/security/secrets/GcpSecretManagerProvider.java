package com.example.syncpad.security.secrets;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * GCP Secret Manager provider for Google Cloud deployments.
 */
public class GcpSecretManagerProvider implements SecretProvider {

    private static final Logger log = LoggerFactory.getLogger(GcpSecretManagerProvider.class);

    private final String projectId;
    private final String secretId;
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GcpSecretManagerProvider(String projectId, String secretId) {
        this.projectId = projectId;
        this.secretId = secretId;
    }

    @Override
    public String getSecret(String key) {
        ensureLoaded();
        return cache.get(key);
    }

    @Override
    public Map<String, String> getAllSecrets() {
        ensureLoaded();
        return Collections.unmodifiableMap(new HashMap<>(cache));
    }

    @Override
    public String getProviderName() {
        return "GCP Secret Manager (" + projectId + ")";
    }

    @Override
    public boolean isAvailable() {
        return secretId != null && !secretId.isBlank();
    }

    private synchronized void ensureLoaded() {
        if (!cache.isEmpty() || !isAvailable()) {
            return;
        }

        String envPayload = System.getenv("GCP_SECRET_PAYLOAD");
        if (envPayload != null && !envPayload.isBlank()) {
            try {
                JsonNode node = objectMapper.readTree(envPayload);
                if (node.isObject()) {
                    node.fields().forEachRemaining(entry -> cache.put(entry.getKey(), entry.getValue().asText()));
                    log.info("Successfully loaded {} secrets from GCP Secret Manager payload", cache.size());
                }
            } catch (Exception e) {
                log.error("Failed to parse GCP Secret Manager payload: {}", e.getMessage());
            }
        }
    }
}
