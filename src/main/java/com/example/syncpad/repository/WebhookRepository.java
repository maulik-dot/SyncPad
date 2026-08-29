package com.example.syncpad.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Webhook;

@Repository
public interface WebhookRepository extends JpaRepository<Webhook, Long> {
    List<Webhook> findByWorkspaceIdAndIsActiveTrue(Long workspaceId);
    List<Webhook> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
}
