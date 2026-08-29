package com.example.syncpad.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.EnterpriseSsoConfig;

@Repository
public interface EnterpriseSsoConfigRepository extends JpaRepository<EnterpriseSsoConfig, Long> {

    Optional<EnterpriseSsoConfig> findByDomainIgnoreCase(String domain);

    boolean existsByDomainIgnoreCase(String domain);
}
