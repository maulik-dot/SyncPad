package com.example.syncpad.service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.request.CreateTemplateRequest;
import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.dto.response.TemplateResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentTemplate;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.DocumentNotFoundException;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.TemplateRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class TemplateService {

    private static final Logger log = LoggerFactory.getLogger(TemplateService.class);

    private final TemplateRepository templateRepository;
    private final DocumentRepository documentRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final UserRepository userRepository;
    private final DocumentService documentService;
    private final AuditLogService auditLogService;

    public TemplateService(
            TemplateRepository templateRepository,
            DocumentRepository documentRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            UserRepository userRepository,
            DocumentService documentService,
            AuditLogService auditLogService
    ) {
        this.templateRepository = templateRepository;
        this.documentRepository = documentRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.userRepository = userRepository;
        this.documentService = documentService;
        this.auditLogService = auditLogService;
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    @Transactional(readOnly = true)
    public List<TemplateResponse> getTemplates(Long workspaceId, String userEmail) {
        List<TemplateResponse> result = new ArrayList<>();

        // 1. Built-in global templates
        List<DocumentTemplate> builtins = templateRepository.findByIsBuiltinTrueOrderByTitleAsc();
        result.addAll(builtins.stream().map(TemplateResponse::fromEntity).collect(Collectors.toList()));

        // 2. Custom workspace templates if workspaceId is provided
        if (workspaceId != null) {
            User user = getUserByEmail(userEmail);
            Workspace workspace = workspaceRepository.findById(workspaceId)
                    .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + workspaceId));

            boolean isOwner = workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId());
            boolean isMember = isOwner || workspacePermissionRepository.findByUserAndWorkspace(user, workspace)
                    .map(p -> !p.isExpired()).orElse(false);

            if (isMember) {
                List<DocumentTemplate> custom = templateRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
                result.addAll(custom.stream().map(TemplateResponse::fromEntity).collect(Collectors.toList()));
            }
        }

        return result;
    }

    @Transactional
    public TemplateResponse createTemplate(CreateTemplateRequest request, String userEmail) {
        User user = getUserByEmail(userEmail);
        Workspace workspace = null;

        if (request.getWorkspaceId() != null) {
            workspace = workspaceRepository.findById(request.getWorkspaceId())
                    .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + request.getWorkspaceId()));

            boolean isOwner = workspace.getOwner() != null && workspace.getOwner().getId().equals(user.getId());
            boolean isAdmin = isOwner || workspacePermissionRepository.findByUserAndWorkspace(user, workspace)
                    .map(p -> !p.isExpired() && (p.getRole() == Role.ADMIN || p.getRole() == Role.OWNER))
                    .orElse(false);

            if (!isAdmin) {
                throw new PermissionDeniedException("Only workspace admins can create workspace templates");
            }
        }

        DocumentTemplate template = new DocumentTemplate(
                request.getTitle().trim(),
                request.getDescription() != null ? request.getDescription().trim() : "",
                request.getContent(),
                request.getCategory() != null ? request.getCategory().trim() : "General",
                request.getIcon() != null ? request.getIcon().trim() : "file-text",
                false,
                workspace,
                user
        );

        DocumentTemplate saved = templateRepository.save(template);
        if (auditLogService != null) {
            auditLogService.log(user, workspace, null, "TEMPLATE_CREATED", "Created template blueprint: " + saved.getTitle());
        }
        return TemplateResponse.fromEntity(saved);
    }

    @Transactional
    public DocumentResponse instantiateTemplate(Long templateId, Long targetWorkspaceId, String titleOverride, String userEmail) {
        DocumentTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new DocumentNotFoundException("Template not found with ID: " + templateId));

        String targetWorkspaceName = null;
        if (targetWorkspaceId != null) {
            Workspace ws = workspaceRepository.findById(targetWorkspaceId)
                    .orElseThrow(() -> new IllegalArgumentException("Workspace not found: " + targetWorkspaceId));
            targetWorkspaceName = ws.getName();
        }

        String docTitle = (titleOverride != null && !titleOverride.isBlank())
                ? titleOverride.trim()
                : template.getTitle();

        Document doc = documentService.createDocument(
                docTitle,
                template.getContent(),
                "DOC",
                null,
                targetWorkspaceName,
                userEmail
        );

        if (auditLogService != null) {
            User user = getUserByEmail(userEmail);
            auditLogService.log(user, null, doc, "TEMPLATE_INSTANTIATED", "Instantiated from template: " + template.getTitle());
        }

        return DocumentResponse.from(doc);
    }
}
