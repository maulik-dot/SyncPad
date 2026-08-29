package com.example.syncpad.security.secrets;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * HashiCorp Vault KV v2 Secret Provider.
 */
public class VaultSecretProvider implements SecretProvider {

    private static final Logger log = LoggerFactory.getLogger(VaultSecretProvider.class);

    private final String vaultAddr;
    private final String vaultToken;
    private final String secretPath;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private volatile long lastFetchTimeMs = 0L;
    private static final long CACHE_TTL_MS = 300_000L;

    public VaultSecretProvider(String vaultAddr, String vaultToken, String secretPath) {
        this.vaultAddr = normalizeUrl(vaultAddr);
        this.vaultToken = vaultToken;
        this.secretPath = secretPath.startsWith("/") ? secretPath.substring(1) : secretPath;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public String getSecret(String key) {
        ensureCacheValid();
        return cache.get(key);
    }

    @Override
    public Map<String, String> getAllSecrets() {
        ensureCacheValid();
        return Collections.unmodifiableMap(new HashMap<>(cache));
    }

    @Override
    public String getProviderName() {
        return "HashiCorp Vault KV v2";
    }

    @Override
    public boolean isAvailable() {
        if (vaultAddr == null || vaultAddr.isBlank() || vaultToken == null || vaultToken.isBlank()) {
            return false;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(vaultAddr + "/v1/sys/health"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200 || response.statusCode() == 429;
        } catch (Exception e) {
            log.debug("Vault healthcheck failed: {}", e.getMessage());
            return false;
        }
    }

    private synchronized void ensureCacheValid() {
        long now = System.currentTimeMillis();
        if (!cache.isEmpty() && (now - lastFetchTimeMs < CACHE_TTL_MS)) {
            return;
        }

        if (vaultAddr == null || vaultToken == null) {
            return;
        }

        try {
            String fullUrl = vaultAddr + "/v1/" + secretPath;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(fullUrl))
                    .header("X-Vault-Token", vaultToken)
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode dataNode = root.path("data").path("data");
                if (dataNode.isMissingNode() || !dataNode.isObject()) {
                    dataNode = root.path("data");
                }

                if (dataNode.isObject()) {
                    Map<String, String> freshSecrets = new HashMap<>();
                    dataNode.fields().forEachRemaining(entry -> {
                        freshSecrets.put(entry.getKey(), entry.getValue().asText());
                    });
                    cache.clear();
                    cache.putAll(freshSecrets);
                    lastFetchTimeMs = now;
                    log.info("Successfully fetched and cached {} secrets from HashiCorp Vault path '{}'",
                            freshSecrets.size(), secretPath);
                }
            } else {
                log.warn("Vault secret request failed with HTTP status {}: {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("Failed to retrieve secrets from HashiCorp Vault at {}: {}", vaultAddr, e.getMessage());
        }
    }

    private String normalizeUrl(String url) {
        if (url == null) return null;
        String trimmed = url.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
