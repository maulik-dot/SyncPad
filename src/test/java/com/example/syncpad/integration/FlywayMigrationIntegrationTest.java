package com.example.syncpad.integration;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;

@SpringBootTest
public class FlywayMigrationIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void testFlywayMigrationAppliesCleanlyOnDatabase() {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(true)
                .locations("classpath:db/migration")
                .load();

        assertDoesNotThrow(() -> {
            flyway.migrate();
        });

        MigrationInfo[] applied = flyway.info().applied();
        assertNotNull(applied);
        assertTrue(applied.length >= 1, "At least baseline V1 migration should be applied");

        assertDoesNotThrow(() -> {
            flyway.validate();
        });
    }

    @Test
    void testFlywayBaselineOnExistingDatabase() {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(true)
                .locations("classpath:db/migration")
                .load();

        assertDoesNotThrow(() -> {
            flyway.validate();
        });
    }
}
