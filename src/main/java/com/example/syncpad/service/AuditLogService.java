package com.example.syncpad.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.AuditLogResponse;
import com.example.syncpad.entity.AuditLog;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.AuditLogRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final DocumentRepository documentRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final DocumentPermissionRepository documentPermissionRepository;

    public AuditLogService(
            AuditLogRepository auditLogRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            DocumentRepository documentRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            DocumentPermissionRepository documentPermissionRepository
    ) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.documentRepository = documentRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.documentPermissionRepository = documentPermissionRepository;
    }

    @Transactional
    public AuditLog log(User user, Workspace workspace, Document document, String action, String details) {
        try {
            Workspace ws = workspace;
            if (ws == null && document != null && document.getWorkspaceName() != null) {
                ws = workspaceRepository.findByName(document.getWorkspaceName()).orElse(null);
            }
            AuditLog log = new AuditLog(user, ws, document, action, details);
            return auditLogRepository.save(log);
        } catch (Exception e) {
            // Non-blocking log failure
            return null;
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getWorkspaceActivity(Long workspaceId, String userEmail, int page, int size) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + workspaceId));

        boolean isOwner = workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId());
        boolean isMember = isOwner || workspacePermissionRepository.findByUserAndWorkspace(user, workspace).isPresent();

        if (!isMember) {
            throw new PermissionDeniedException("Access denied: You are not a member of this workspace");
        }

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        Page<AuditLog> logPage = auditLogRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId, pageable);
        return logPage.map(AuditLogResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getDocumentActivity(Long documentId, String userEmail, int page, int size) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        // Check document access
        boolean hasAccess = false;
        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            hasAccess = true;
        } else if (documentPermissionRepository.findByUserAndDocument(user, document).isPresent()) {
            hasAccess = true;
        } else if (document.getWorkspaceName() != null) {
            var wsOpt = workspaceRepository.findByName(document.getWorkspaceName());
            if (wsOpt.isPresent()) {
                Workspace ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    hasAccess = true;
                } else if (workspacePermissionRepository.findByUserAndWorkspace(user, ws).isPresent()) {
                    hasAccess = true;
                }
            }
        }

        if (!hasAccess) {
            throw new PermissionDeniedException("Access denied: You do not have access to view this document's activity");
        }

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        Page<AuditLog> logPage = auditLogRepository.findByDocumentIdOrderByCreatedAtDesc(documentId, pageable);
        return logPage.map(AuditLogResponse::fromEntity);
    }
}
