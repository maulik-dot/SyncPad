package com.example.syncpad.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class DatabaseMigrationConfig {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMigrationConfig.class);

    @Bean
    public Flyway flyway(DataSource dataSource, Environment env) {
        boolean enabled = env.getProperty("spring.flyway.enabled", Boolean.class, true);
        if (!enabled) {
            logger.info("Flyway database migrations are disabled by configuration.");
            return null;
        }

        logger.info("Initializing Flyway and running database migrations on [{}]...", dataSource);
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(true)
                .locations("classpath:db/migration")
                .load();

        int migrationsApplied = flyway.migrate().migrationsExecuted;
        logger.info("Flyway successfully applied {} database migration(s).", migrationsApplied);
        return flyway;
    }

    @Bean
    public static BeanFactoryPostProcessor entityManagerFactoryDependsOnFlyway() {
        return beanFactory -> {
            if (beanFactory.containsBeanDefinition("entityManagerFactory")) {
                BeanDefinition bd = beanFactory.getBeanDefinition("entityManagerFactory");
                String[] existing = bd.getDependsOn();
                List<String> dependsOn = new ArrayList<>(existing != null ? Arrays.asList(existing) : List.of());
                if (!dependsOn.contains("flyway")) {
                    dependsOn.add("flyway");
                    bd.setDependsOn(dependsOn.toArray(new String[0]));
                }
            }
        };
    }
}
