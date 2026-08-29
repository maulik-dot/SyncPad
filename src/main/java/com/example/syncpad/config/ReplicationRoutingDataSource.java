package com.example.syncpad.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

public class ReplicationRoutingDataSource extends AbstractRoutingDataSource {

    private static final Logger log = LoggerFactory.getLogger(ReplicationRoutingDataSource.class);

    @Override
    protected Object determineCurrentLookupKey() {
        boolean isReadOnly = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        DataSourceType selected = isReadOnly ? DataSourceType.REPLICA : DataSourceType.PRIMARY;
        log.trace("Routing database connection: isReadOnly={}, selected={}", isReadOnly, selected);
        return selected;
    }
}

