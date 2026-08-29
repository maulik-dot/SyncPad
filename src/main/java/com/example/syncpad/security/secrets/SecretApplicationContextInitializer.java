package com.example.syncpad.security.secrets;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Spring Framework ApplicationContextInitializer that guarantees externalized secret resolution
 * before any beans or PropertySourcesPlaceholderConfigurers are created.
 */
public class SecretApplicationContextInitializer
        implements ApplicationContextInitializer<ConfigurableApplicationContext>, Ordered {

    private static final Logger log = LoggerFactory.getLogger(SecretApplicationContextInitializer.class);
    private static final String PROPERTY_SOURCE_NAME = "externalizedSecrets";

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        ConfigurableEnvironment environment = applicationContext.getEnvironment();

        String vaultAddr = getSetting(environment, "VAULT_ADDR", "vault.addr");
        String vaultToken = getSetting(environment, "VAULT_TOKEN", "vault.token");
        String secretPath = getSetting(environment, "VAULT_SECRET_PATH", "vault.secret-path");
        if (secretPath == null || secretPath.isBlank()) {
            secretPath = "secret/data/syncpad";
        }

        SecretProvider activeProvider = null;

        // 1. HashiCorp Vault
        if (vaultAddr != null && !vaultAddr.isBlank() && vaultToken != null && !vaultToken.isBlank()) {
            VaultSecretProvider vaultProvider = new VaultSecretProvider(vaultAddr, vaultToken, secretPath);
            if (vaultProvider.isAvailable()) {
                activeProvider = vaultProvider;
            } else {
                log.warn("HashiCorp Vault at '{}' was configured but healthcheck failed. Falling back.", vaultAddr);
            }
        }

        // 2. AWS Secrets Manager
        if (activeProvider == null) {
            String awsSecretId = getSetting(environment, "AWS_SECRET_ID", "aws.secretsmanager.secret-id");
            String awsRegion = getSetting(environment, "AWS_REGION", "aws.secretsmanager.region");
            if (awsSecretId != null && !awsSecretId.isBlank()) {
                activeProvider = new AwsSecretsManagerProvider(awsSecretId, awsRegion);
            }
        }

        // 3. GCP Secret Manager
        if (activeProvider == null) {
            String gcpProjectId = getSetting(environment, "GCP_PROJECT_ID", "gcp.secrets.project-id");
            String gcpSecretId = getSetting(environment, "GCP_SECRET_ID", "gcp.secrets.secret-id");
            if (gcpSecretId != null && !gcpSecretId.isBlank()) {
                activeProvider = new GcpSecretManagerProvider(gcpProjectId, gcpSecretId);
            }
        }

        if (activeProvider != null) {
            Map<String, String> resolvedSecrets = activeProvider.getAllSecrets();
            if (!resolvedSecrets.isEmpty()) {
                Map<String, Object> injectedProperties = new HashMap<>();

                // Inject raw keys
                injectedProperties.putAll(resolvedSecrets);

                // Map standard database properties if present
                if (resolvedSecrets.containsKey("POSTGRES_PASSWORD")) {
                    String pgPass = resolvedSecrets.get("POSTGRES_PASSWORD");
                    injectedProperties.put("spring.datasource.password", pgPass);
                    injectedProperties.put("SPRING_DATASOURCE_PASSWORD", pgPass);
                }
                if (resolvedSecrets.containsKey("SPRING_DATASOURCE_PASSWORD")) {
                    String pgPass = resolvedSecrets.get("SPRING_DATASOURCE_PASSWORD");
                    injectedProperties.put("spring.datasource.password", pgPass);
                    injectedProperties.put("SPRING_DATASOURCE_PASSWORD", pgPass);
                }

                // Map JWT signing key if present
                if (resolvedSecrets.containsKey("JWT_SECRET")) {
                    String jwtSec = resolvedSecrets.get("JWT_SECRET");
                    injectedProperties.put("jwt.secret", jwtSec);
                    injectedProperties.put("JWT_SECRET", jwtSec);
                }

                // Map RabbitMQ message broker credentials if present
                if (resolvedSecrets.containsKey("RABBITMQ_PASSWORD")) {
                    String rabbitPass = resolvedSecrets.get("RABBITMQ_PASSWORD");
                    injectedProperties.put("spring.websocket.relay.client-passcode", rabbitPass);
                    injectedProperties.put("spring.websocket.relay.system-passcode", rabbitPass);
                }

                MapPropertySource propertySource = new MapPropertySource(PROPERTY_SOURCE_NAME, injectedProperties);
                environment.getPropertySources().addFirst(propertySource);

                System.out.println("==================================================================");
                System.out.println(">>> [Secret Hardening] Successfully loaded " + injectedProperties.size()
                        + " secrets from " + activeProvider.getProviderName());
                System.out.println("==================================================================");
            }
        } else {
            System.out.println(">>> [Secret Hardening] No external vault configured. Using local environment.");
        }
    }

    private String getSetting(ConfigurableEnvironment env, String envKey, String propKey) {
        String val = env.getProperty(envKey);
        if (val == null || val.isBlank()) {
            val = env.getProperty(propKey);
        }
        if (val == null || val.isBlank()) {
            val = System.getenv(envKey);
        }
        return val;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
