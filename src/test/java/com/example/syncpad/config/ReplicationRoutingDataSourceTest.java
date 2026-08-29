package com.example.syncpad.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class ReplicationRoutingDataSourceTest {

    private ReplicationRoutingDataSource routingDataSource;

    @BeforeEach
    void setUp() {
        routingDataSource = new ReplicationRoutingDataSource();
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
    }

    @Test
    void determineCurrentLookupKey_whenReadOnly_returnsReplica() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);

        Object lookupKey = routingDataSource.determineCurrentLookupKey();
        assertEquals(DataSourceType.REPLICA, lookupKey);
    }

    @Test
    void determineCurrentLookupKey_whenReadWrite_returnsPrimary() {
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);

        Object lookupKey = routingDataSource.determineCurrentLookupKey();
        assertEquals(DataSourceType.PRIMARY, lookupKey);
    }

    @Test
    void determineCurrentLookupKey_whenNoTransaction_returnsPrimary() {
        Object lookupKey = routingDataSource.determineCurrentLookupKey();
        assertEquals(DataSourceType.PRIMARY, lookupKey);
    }
}

