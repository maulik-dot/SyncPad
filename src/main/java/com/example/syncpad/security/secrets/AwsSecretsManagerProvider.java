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
 * AWS Secrets Manager provider for AWS ECS / EKS / EC2 deployments.
 */
public class AwsSecretsManagerProvider implements SecretProvider {

    private static final Logger log = LoggerFactory.getLogger(AwsSecretsManagerProvider.class);

    private final String secretId;
    private final String region;
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AwsSecretsManagerProvider(String secretId, String region) {
        this.secretId = secretId;
        this.region = (region != null && !region.isBlank()) ? region : "us-east-1";
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
        return "AWS Secrets Manager (" + region + ")";
    }

    @Override
    public boolean isAvailable() {
        return secretId != null && !secretId.isBlank();
    }

    private synchronized void ensureLoaded() {
        if (!cache.isEmpty() || !isAvailable()) {
            return;
        }

        String envPayload = System.getenv("AWS_SECRET_PAYLOAD");
        if (envPayload != null && !envPayload.isBlank()) {
            try {
                JsonNode node = objectMapper.readTree(envPayload);
                if (node.isObject()) {
                    node.fields().forEachRemaining(entry -> cache.put(entry.getKey(), entry.getValue().asText()));
                    log.info("Successfully loaded {} secrets from AWS Secrets Manager payload", cache.size());
                }
            } catch (Exception e) {
                log.error("Failed to parse AWS Secrets Manager payload: {}", e.getMessage());
            }
        }
    }
}
