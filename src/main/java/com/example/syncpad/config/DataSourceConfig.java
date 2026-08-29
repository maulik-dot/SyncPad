package com.example.syncpad.config;

import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import com.zaxxer.hikari.HikariDataSource;

@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean(name = "primaryDataSource")
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource primaryDataSource(Environment env) {
        HikariDataSource ds = new HikariDataSource();
        String url = env.getProperty("spring.datasource.url");
        String username = env.getProperty("spring.datasource.username");
        String password = env.getProperty("spring.datasource.password");
        String driver = env.getProperty("spring.datasource.driver-class-name");

        if (url != null) ds.setJdbcUrl(url);
        if (username != null) ds.setUsername(username);
        if (password != null) ds.setPassword(password);
        if (driver != null) ds.setDriverClassName(driver);

        ds.setPoolName("HikariPool-Primary");
        log.info("Configuring Primary write DataSource: url={}", url);
        return ds;
    }

    @Bean(name = "replicaDataSource")
    public DataSource replicaDataSource(
            Environment env,
            @Qualifier("primaryDataSource") DataSource primaryDataSource
    ) {
        String replicaUrl = env.getProperty("spring.datasource.replica.url");
        if (replicaUrl == null || replicaUrl.isBlank() || replicaUrl.equals(env.getProperty("spring.datasource.url"))) {
            log.info("No distinct replica database configured ('spring.datasource.replica.url' is unset). Using primary DataSource for read operations.");
            return primaryDataSource;
        }

        log.info("Configuring dedicated Read-Replica DataSource: url={}", replicaUrl);
        String username = env.getProperty("spring.datasource.replica.username", env.getProperty("spring.datasource.username", "syncpad_user"));
        String password = env.getProperty("spring.datasource.replica.password", env.getProperty("spring.datasource.password", ""));
        String driver = env.getProperty("spring.datasource.replica.driver-class-name", env.getProperty("spring.datasource.driver-class-name", "org.postgresql.Driver"));

        HikariDataSource replicaDs = new HikariDataSource();
        replicaDs.setJdbcUrl(replicaUrl);
        replicaDs.setUsername(username);
        replicaDs.setPassword(password);
        replicaDs.setDriverClassName(driver);
        replicaDs.setPoolName("HikariPool-Replica");
        replicaDs.setReadOnly(true);
        return replicaDs;
    }

    @Bean(name = "routingDataSource")
    public DataSource routingDataSource(
            @Qualifier("primaryDataSource") DataSource primaryDataSource,
            @Qualifier("replicaDataSource") DataSource replicaDataSource
    ) {
        ReplicationRoutingDataSource routingDataSource = new ReplicationRoutingDataSource();
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put(DataSourceType.PRIMARY, primaryDataSource);
        targetDataSources.put(DataSourceType.REPLICA, replicaDataSource);

        routingDataSource.setTargetDataSources(targetDataSources);
        routingDataSource.setDefaultTargetDataSource(primaryDataSource);
        routingDataSource.afterPropertiesSet();

        log.info("ReplicationRoutingDataSource initialized with Primary and Replica targets.");
        return routingDataSource;
    }

    @Bean(name = "dataSource")
    @Primary
    public DataSource dataSource(@Qualifier("routingDataSource") DataSource routingDataSource) {
        log.info("Wrapping routing DataSource in LazyConnectionDataSourceProxy for dynamic transaction inspection.");
        return new LazyConnectionDataSourceProxy(routingDataSource);
    }
}

