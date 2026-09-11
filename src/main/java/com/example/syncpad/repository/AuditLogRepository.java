package com.example.syncpad.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.AuditLog;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Workspace;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId, Pageable pageable);
    Page<AuditLog> findByDocumentIdOrderByCreatedAtDesc(Long documentId, Pageable pageable);
    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    void deleteByWorkspace(Workspace workspace);
    void deleteByDocument(Document document);
}
