package com.example.syncpad.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.DocumentDetailResponse;
import com.example.syncpad.dto.response.DocumentStatsResponse;
import com.example.syncpad.dto.response.DocumentVersionResponse;
import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentPermission;
import com.example.syncpad.entity.DocumentVersion;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.DocumentNotFoundException;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.DocumentVersionRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.ShareLinkRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final DocumentVersionRepository versionRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final FolderRepository folderRepository;
    private final DocumentCommentRepository commentRepository;
    private final FolderService folderService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;

    public DocumentService(
            DocumentRepository documentRepository,
            UserRepository userRepository,
            DocumentPermissionRepository permissionRepository,
            DocumentVersionRepository versionRepository,
            ShareLinkRepository shareLinkRepository,
            FolderRepository folderRepository,
            DocumentCommentRepository commentRepository,
            FolderService folderService,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository
    ) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.permissionRepository = permissionRepository;
        this.versionRepository = versionRepository;
        this.shareLinkRepository = shareLinkRepository;
        this.folderRepository = folderRepository;
        this.commentRepository = commentRepository;
        this.folderService = folderService;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
    }

    public Role getEffectiveRole(Document document, User user) {
        if (document == null || user == null) return null;

        // 1. Document Owner has OWNER permissions
        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            return Role.OWNER;
        }

        // 2. Explicit DocumentPermission override for this user
        Optional<DocumentPermission> explicit = permissionRepository.findByUserAndDocument(user, document);
        if (explicit.isPresent()) {
            Role explicitRole = explicit.get().getRole();
            if (explicitRole == Role.RESTRICTED) {
                return null; // Explicitly restricted
            }
            return explicitRole;
        }

        // 3. Parent Folder Restriction Check
        if (document.getFolder() != null) {
            Role folderRole = folderService.getEffectiveRole(document.getFolder(), user);
            if (folderRole == null) {
                return null; // Restricted at folder level
            }
        }

        // 4. Inherit from Workspace
        String wsName = document.getWorkspaceName();
        if (wsName == null && document.getFolder() != null) {
            wsName = document.getFolder().getWorkspaceName();
        }

        if (wsName != null && !wsName.isBlank()) {
            Optional<Workspace> wsOpt = workspaceRepository.findByName(wsName);
            if (wsOpt.isPresent()) {
                Workspace ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return Role.OWNER;
                }
                Optional<WorkspacePermission> wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent()) {
                    return wsPerm.get().getRole();
                }
            }
        }

        return null;
    }

    public boolean isUserDocumentAdmin(Document document, User user) {
        if (document == null || user == null) return false;

        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            return true;
        }

        String wsName = document.getWorkspaceName();
        if (wsName == null && document.getFolder() != null) {
            wsName = document.getFolder().getWorkspaceName();
        }

        if (wsName != null && !wsName.isBlank()) {
            Optional<Workspace> wsOpt = workspaceRepository.findByName(wsName);
            if (wsOpt.isPresent()) {
                Workspace ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return true;
                }
                Optional<WorkspacePermission> wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent() && (wsPerm.get().getRole() == Role.OWNER || wsPerm.get().getRole() == Role.ADMIN)) {
                    return true;
                }
            }
        }

        Optional<DocumentPermission> explicit = permissionRepository.findByUserAndDocument(user, document);
        return explicit.map(p -> p.getRole() == Role.OWNER || p.getRole() == Role.ADMIN).orElse(false);
    }

    @Transactional
    public Document createDocument(String title, String content, String userEmail) {
        return createDocument(title, content, "DOC", null, null, userEmail);
    }

    @Transactional
    public Document createDocument(String title, String content, String fileTypeStr, Long folderId, String userEmail) {
        return createDocument(title, content, fileTypeStr, folderId, null, userEmail);
    }

    @Transactional
    public Document createDocument(String title, String content, String fileTypeStr, Long folderId, String workspaceName, String userEmail) {
        User owner = getUserByEmail(userEmail);
        com.example.syncpad.entity.FileType fileType = com.example.syncpad.entity.FileType.DOC;
        if (fileTypeStr != null && !fileTypeStr.isBlank()) {
            try {
                fileType = com.example.syncpad.entity.FileType.valueOf(fileTypeStr.toUpperCase());
            } catch (Exception ignored) {}
        }

        Folder folder = null;
        if (folderId != null) {
            folder = folderRepository.findById(folderId).orElse(null);
            if (folder != null && (workspaceName == null || workspaceName.isBlank())) {
                workspaceName = folder.getWorkspaceName();
            }
        }

        Document document = new Document(title, content, fileType, workspaceName, folder, owner);
        Document savedDocument = documentRepository.save(document);

        DocumentPermission ownerPermission = new DocumentPermission(owner, savedDocument, Role.OWNER);
        permissionRepository.save(ownerPermission);

        saveSnapshot(savedDocument, 1, owner);

        return savedDocument;
    }

    public Document getDocument(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view this document");
        }

        return document;
    }

    public DocumentDetailResponse getDocumentDetail(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view this document");
        }

        DocumentStatsResponse stats = computeDocumentStats(document);

        Long folderId = document.getFolder() != null ? document.getFolder().getId() : null;
        String folderName = document.getFolder() != null ? document.getFolder().getName() : null;

        Long ownerId = document.getOwner() != null ? document.getOwner().getId() : null;
        String ownerName = document.getOwner() != null ? document.getOwner().getName() : "Unknown";
        String ownerEmail = document.getOwner() != null ? document.getOwner().getEmail() : "unknown@syncpad.com";

        return new DocumentDetailResponse(
                document.getId(),
                document.getTitle(),
                document.getContent(),
                document.getFileType(),
                folderId,
                folderName,
                ownerId,
                ownerName,
                ownerEmail,
                effectiveRole,
                1L,
                document.isTrashed(),
                stats,
                document.getCreatedAt(),
                document.getUpdatedAt()
        );
    }

    public DocumentStatsResponse getDocumentStats(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view this document");
        }

        return computeDocumentStats(document);
    }

    @Transactional
    public Document renameDocument(Long id, String newTitle, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to rename this document");
        }

        if (effectiveRole == Role.VIEWER) {
            throw new PermissionDeniedException("Viewers cannot rename documents");
        }

        document.setTitle(newTitle != null && !newTitle.isBlank() ? newTitle.trim() : "Untitled Document");
        document.setUpdatedAt(java.time.LocalDateTime.now());
        return documentRepository.save(document);
    }

    private DocumentStatsResponse computeDocumentStats(Document document) {
        String content = document.getContent();
        int wordCount = 0;
        int characterCount = 0;
        int paragraphCount = 0;
        int headingCount = 0;

        if (content != null && !content.isBlank()) {
            String plainText = content.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
            characterCount = plainText.length();
            if (!plainText.isEmpty()) {
                wordCount = plainText.split("\\s+").length;
            }

            String[] pSplits = content.split("(?i)</p>|\\n{2,}|<br\\s*/?>");
            paragraphCount = Math.max(1, (int) java.util.Arrays.stream(pSplits)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty() && !s.replaceAll("<[^>]*>", "").isBlank())
                    .count());

            java.util.regex.Matcher headingMatcher = java.util.regex.Pattern.compile("(?i)<h[1-6][^>]*>|^#{1,6}\\s+", java.util.regex.Pattern.MULTILINE).matcher(content);
            while (headingMatcher.find()) {
                headingCount++;
            }
        }

        int readingTimeMinutes = Math.max(1, (int) Math.ceil(wordCount / 200.0));

        List<DocumentVersion> versions = versionRepository.findByDocumentOrderByVersionNumberDesc(document);
        int versionCount = versions.size();

        List<DocumentPermission> permissions = permissionRepository.findByDocument(document);
        int collaboratorCount = permissions.size();

        String lastEditedBy = "Unknown";
        if (!versions.isEmpty() && versions.get(0).getEditedBy() != null) {
            lastEditedBy = versions.get(0).getEditedBy().getName() != null ? versions.get(0).getEditedBy().getName() : versions.get(0).getEditedBy().getEmail();
        } else if (document.getOwner() != null) {
            lastEditedBy = document.getOwner().getName() != null ? document.getOwner().getName() : document.getOwner().getEmail();
        }

        return new DocumentStatsResponse(
                document.getId(),
                document.getTitle(),
                wordCount,
                characterCount,
                paragraphCount,
                headingCount,
                readingTimeMinutes,
                versionCount,
                collaboratorCount,
                lastEditedBy,
                document.getCreatedAt(),
                document.getUpdatedAt()
        );
    }

    public List<Document> getAccessibleDocuments(String userEmail) {
        return getAccessibleDocuments(userEmail, null);
    }

    public List<Document> getAccessibleDocuments(String userEmail, String typeStr) {
        User user = getUserByEmail(userEmail);
        List<Document> allDocs = documentRepository.findAll();

        return allDocs.stream()
                .filter(doc -> !doc.isTrashed())
                .filter(doc -> getEffectiveRole(doc, user) != null)
                .filter(doc -> {
                    if (typeStr == null || typeStr.isBlank()) return true;
                    try {
                        com.example.syncpad.entity.FileType requestedType = com.example.syncpad.entity.FileType.valueOf(typeStr.toUpperCase());
                        return doc.getFileType() == requestedType;
                    } catch (Exception e) {
                        return true;
                    }
                })
                .collect(Collectors.toList());
    }

    public List<Document> getDocumentsByFolder(Long folderId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new DocumentNotFoundException("Folder not found with ID: " + folderId));

        if (folderService.getEffectiveRole(folder, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have permission to access this folder");
        }

        List<Document> allDocs = documentRepository.findByFolderId(folderId);
        return allDocs.stream()
                .filter(doc -> !doc.isTrashed())
                .filter(doc -> getEffectiveRole(doc, user) != null)
                .collect(Collectors.toList());
    }

    @Transactional
    public Document updateDocument(Long id, String title, String content, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to edit this document");
        }

        if (effectiveRole == Role.VIEWER) {
            throw new PermissionDeniedException("Viewers cannot edit document content");
        }

        if (title != null && !title.isBlank()) {
            document.setTitle(title.trim());
        }
        if (content != null) {
            document.setContent(content);
        }
        document.setUpdatedAt(java.time.LocalDateTime.now());
        Document updatedDocument = documentRepository.save(document);

        List<DocumentVersion> existingVersions = versionRepository.findByDocumentOrderByVersionNumberDesc(updatedDocument);
        int nextVersion = existingVersions.isEmpty() ? 1 : existingVersions.get(0).getVersionNumber() + 1;
        saveSnapshot(updatedDocument, nextVersion, user);

        return updatedDocument;
    }

    @Transactional
    public void deleteDocument(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(id);

        if (!isUserDocumentAdmin(document, user)) {
            throw new PermissionDeniedException("Only the document owner or workspace admin can delete this document");
        }

        List<DocumentVersion> versions = versionRepository.findByDocumentOrderByVersionNumberDesc(document);
        versionRepository.deleteAll(versions);

        List<DocumentPermission> allPermissions = permissionRepository.findByDocument(document);
        permissionRepository.deleteAll(allPermissions);

        shareLinkRepository.deleteByDocument(document);

        documentRepository.delete(document);
    }

    @Transactional
    public PermissionResponse shareDocument(Long documentId, String currentUserEmail, String targetUserEmail, Role role) {
        return updateDocumentPermission(documentId, null, targetUserEmail, role, currentUserEmail);
    }

    public List<PermissionResponse> getPermissions(Long documentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view this document");
        }

        List<DocumentPermission> explicitPerms = permissionRepository.findByDocument(document);
        Set<Long> processedUserIds = new HashSet<>();
        List<PermissionResponse> result = new ArrayList<>();

        for (DocumentPermission dp : explicitPerms) {
            result.add(new PermissionResponse(
                    dp.getId(),
                    dp.getUser().getId(),
                    dp.getUser().getName(),
                    dp.getUser().getEmail(),
                    dp.getRole()
            ));
            processedUserIds.add(dp.getUser().getId());
        }

        // Add workspace members
        String wsName = document.getWorkspaceName();
        if (wsName == null && document.getFolder() != null) {
            wsName = document.getFolder().getWorkspaceName();
        }

        if (wsName != null && !wsName.isBlank()) {
            workspaceRepository.findByName(wsName).ifPresent(ws -> {
                if (ws.getOwner() != null && !processedUserIds.contains(ws.getOwner().getId())) {
                    result.add(new PermissionResponse(
                            null,
                            ws.getOwner().getId(),
                            ws.getOwner().getName(),
                            ws.getOwner().getEmail(),
                            Role.OWNER
                    ));
                    processedUserIds.add(ws.getOwner().getId());
                }

                List<WorkspacePermission> wsPerms = workspacePermissionRepository.findByWorkspace(ws);
                for (WorkspacePermission wp : wsPerms) {
                    if (!processedUserIds.contains(wp.getUser().getId())) {
                        result.add(new PermissionResponse(
                                null,
                                wp.getUser().getId(),
                                wp.getUser().getName(),
                                wp.getUser().getEmail(),
                                wp.getRole()
                        ));
                        processedUserIds.add(wp.getUser().getId());
                    }
                }
            });
        }

        return result;
    }

    @Transactional
    public PermissionResponse updateDocumentPermission(Long documentId, Long targetUserId, String targetEmail, Role role, String requesterEmail) {
        User requester = getUserByEmail(requesterEmail);
        Document document = findDocumentById(documentId);

        if (!isUserDocumentAdmin(document, requester)) {
            throw new PermissionDeniedException("Only the document owner or workspace admin can manage permissions and restrictions");
        }

        User targetUser = null;
        if (targetUserId != null) {
            targetUser = userRepository.findById(targetUserId).orElse(null);
        }
        if (targetUser == null && targetEmail != null && !targetEmail.isBlank()) {
            targetUser = userRepository.findByEmail(targetEmail).orElse(null);
        }
        if (targetUser == null) {
            throw new DocumentNotFoundException("Target user not found");
        }

        if (document.getOwner() != null && document.getOwner().getId().equals(targetUser.getId())) {
            throw new PermissionDeniedException("Cannot restrict or modify permissions for Document Owner");
        }

        final User finalTargetUser = targetUser;
        Optional<DocumentPermission> existing = permissionRepository.findByUserAndDocument(finalTargetUser, document);
        if (role == null) {
            existing.ifPresent(permissionRepository::delete);
            return new PermissionResponse(null, finalTargetUser.getId(), finalTargetUser.getName(), finalTargetUser.getEmail(), null);
        }

        DocumentPermission perm = existing.orElseGet(() -> new DocumentPermission(finalTargetUser, document, role));
        perm.setRole(role);
        DocumentPermission saved = permissionRepository.save(perm);
        return new PermissionResponse(saved.getId(), finalTargetUser.getId(), finalTargetUser.getName(), finalTargetUser.getEmail(), saved.getRole());
    }

    @Transactional
    public void removeDocumentPermission(Long documentId, Long targetUserId, String requesterEmail) {
        User requester = getUserByEmail(requesterEmail);
        Document document = findDocumentById(documentId);

        if (!isUserDocumentAdmin(document, requester)) {
            throw new PermissionDeniedException("Only the document owner or workspace admin can remove permissions");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new DocumentNotFoundException("Target user not found"));

        permissionRepository.findByUserAndDocument(targetUser, document)
                .ifPresent(permissionRepository::delete);
    }

    public List<DocumentVersionResponse> getVersions(Long documentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view version history");
        }

        List<DocumentVersion> versions = versionRepository.findByDocumentOrderByVersionNumberDesc(document);

        return versions.stream()
                .map(v -> new DocumentVersionResponse(
                        v.getId(),
                        v.getVersionNumber(),
                        v.getTitle(),
                        v.getContent(),
                        v.getEditedBy() != null ? v.getEditedBy().getEmail() : "Unknown",
                        v.getEditedBy() != null ? v.getEditedBy().getName() : "Unknown",
                        v.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public Document restoreVersion(Long documentId, Integer versionNumber, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null || effectiveRole == Role.VIEWER) {
            throw new PermissionDeniedException("You do not have access to restore versions for this document");
        }

        DocumentVersion versionToRestore = versionRepository.findByDocumentAndVersionNumber(document, versionNumber)
                .orElseThrow(() -> new DocumentNotFoundException("Version " + versionNumber + " not found"));

        document.setTitle(versionToRestore.getTitle());
        document.setContent(versionToRestore.getContent());
        Document restoredDocument = documentRepository.save(document);

        List<DocumentVersion> existingVersions = versionRepository.findByDocumentOrderByVersionNumberDesc(restoredDocument);
        int nextVersion = existingVersions.isEmpty() ? 1 : existingVersions.get(0).getVersionNumber() + 1;
        saveSnapshot(restoredDocument, nextVersion, user);

        return restoredDocument;
    }

    private void saveSnapshot(Document document, int versionNumber, User user) {
        DocumentVersion version = new DocumentVersion(
                document,
                versionNumber,
                document.getTitle(),
                document.getContent(),
                user
        );
        versionRepository.save(version);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new DocumentNotFoundException("User not found: " + email));
    }

    private Document findDocumentById(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new DocumentNotFoundException("Document not found with ID: " + id));
    }

    @Transactional
    public com.example.syncpad.dto.response.ShareLinkResponse generateShareLink(
            Long documentId,
            String currentUserEmail,
            com.example.syncpad.dto.request.CreateShareLinkRequest request
    ) {
        User user = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new PermissionDeniedException("User not found"));
        Document document = findDocumentById(documentId);

        if (!isUserDocumentAdmin(document, user)) {
            throw new PermissionDeniedException("Only the OWNER or ADMIN can generate share links");
        }

        shareLinkRepository.findByDocumentAndActiveTrue(document)
                .ifPresent(l -> { l.setActive(false); shareLinkRepository.save(l); });

        String token = java.util.UUID.randomUUID().toString().substring(0, 8);
        java.time.LocalDateTime expiresAt = (request.getExpiresInDays() != null && request.getExpiresInDays() > 0)
                ? java.time.LocalDateTime.now().plusDays(request.getExpiresInDays())
                : null;

        com.example.syncpad.entity.ShareLink shareLink = new com.example.syncpad.entity.ShareLink(document, token, request.getRole(), expiresAt);
        com.example.syncpad.entity.ShareLink saved = shareLinkRepository.save(shareLink);

        String url = "/share/" + token;
        return new com.example.syncpad.dto.response.ShareLinkResponse(
                saved.getId(), document.getId(), saved.getToken(), url, saved.getRole(), saved.getExpiresAt(), saved.isActive()
        );
    }

    @Transactional
    public Document getDocumentByShareToken(String token, String currentUserEmail) {
        com.example.syncpad.entity.ShareLink shareLink = shareLinkRepository.findByToken(token)
                .orElseThrow(() -> new DocumentNotFoundException("Share link not found or invalid"));

        if (!shareLink.isActive()) {
            throw new PermissionDeniedException("This share link has been revoked");
        }

        if (shareLink.getExpiresAt() != null && java.time.LocalDateTime.now().isAfter(shareLink.getExpiresAt())) {
            throw new PermissionDeniedException("This share link has expired");
        }

        Document document = shareLink.getDocument();

        if (currentUserEmail != null && !currentUserEmail.isBlank()) {
            userRepository.findByEmail(currentUserEmail).ifPresent(user -> {
                boolean hasPermission = permissionRepository.findByUserAndDocument(user, document).isPresent();
                if (!hasPermission && !document.getOwner().getId().equals(user.getId())) {
                    DocumentPermission perm = new DocumentPermission(user, document, shareLink.getRole());
                    permissionRepository.save(perm);
                }
            });
        }

        return document;
    }

    @Transactional
    public void revokeShareLink(String token, String currentUserEmail) {
        com.example.syncpad.entity.ShareLink shareLink = shareLinkRepository.findByToken(token)
                .orElseThrow(() -> new DocumentNotFoundException("Share link not found"));
        User user = userRepository.findByEmail(currentUserEmail)
                .orElseThrow(() -> new PermissionDeniedException("User not found"));

        Document document = shareLink.getDocument();
        if (!isUserDocumentAdmin(document, user)) {
            throw new PermissionDeniedException("Only the OWNER or ADMIN can revoke share links");
        }

        shareLink.setActive(false);
        shareLinkRepository.save(shareLink);
    }

    // ==========================================
    // COMMENTS ENGINE
    // ==========================================

    public List<com.example.syncpad.dto.response.DocumentCommentResponse> getComments(Long documentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to view this document");
        }

        List<com.example.syncpad.entity.DocumentComment> topLevelComments = 
                commentRepository.findByDocumentAndParentIsNullOrderByCreatedAtAsc(document);

        return topLevelComments.stream()
                .map(com.example.syncpad.dto.response.DocumentCommentResponse::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public com.example.syncpad.dto.response.DocumentCommentResponse createComment(
            Long documentId, 
            String userEmail, 
            com.example.syncpad.dto.request.CreateCommentRequest request
    ) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to comment on this document");
        }

        com.example.syncpad.entity.DocumentComment parent = null;
        if (request.getParentId() != null) {
            parent = commentRepository.findById(request.getParentId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent comment not found"));
        }

        com.example.syncpad.entity.DocumentComment comment = new com.example.syncpad.entity.DocumentComment(
                document,
                user,
                request.getText(),
                request.getAnchorText(),
                parent
        );

        com.example.syncpad.entity.DocumentComment saved = commentRepository.save(comment);
        return com.example.syncpad.dto.response.DocumentCommentResponse.fromEntity(saved);
    }

    @Transactional
    public com.example.syncpad.dto.response.DocumentCommentResponse resolveComment(Long documentId, Long commentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        if (getEffectiveRole(document, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to modify comments on this document");
        }

        com.example.syncpad.entity.DocumentComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        comment.setResolved(!comment.isResolved());
        comment.setUpdatedAt(java.time.LocalDateTime.now());
        com.example.syncpad.entity.DocumentComment updated = commentRepository.save(comment);
        return com.example.syncpad.dto.response.DocumentCommentResponse.fromEntity(updated);
    }

    @Transactional
    public void deleteComment(Long documentId, Long commentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null) {
            throw new PermissionDeniedException("Access restricted: You do not have access to this document");
        }

        com.example.syncpad.entity.DocumentComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        boolean isAuthor = comment.getAuthor().getId().equals(user.getId());
        boolean isOwnerOrAdmin = effectiveRole == Role.OWNER || effectiveRole == Role.ADMIN;

        if (!isAuthor && !isOwnerOrAdmin) {
            throw new PermissionDeniedException("You do not have permission to delete this comment");
        }

        commentRepository.delete(comment);
    }

    // ==========================================
    // PDF ATTACHMENT ENGINE
    // ==========================================

    @Transactional
    public Document attachPdf(Long documentId, String fileName, String pdfUrl, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null || effectiveRole == Role.VIEWER) {
            throw new PermissionDeniedException("You do not have permission to attach PDF files");
        }

        document.setPdfFileName(fileName);
        document.setPdfUrl(pdfUrl);
        document.setUpdatedAt(java.time.LocalDateTime.now());
        return documentRepository.save(document);
    }

    @Transactional
    public Document detachPdf(Long documentId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Document document = findDocumentById(documentId);

        Role effectiveRole = getEffectiveRole(document, user);
        if (effectiveRole == null || effectiveRole == Role.VIEWER) {
            throw new PermissionDeniedException("You do not have permission to detach PDF files");
        }

        document.setPdfFileName(null);
        document.setPdfUrl(null);
        document.setUpdatedAt(java.time.LocalDateTime.now());
        return documentRepository.save(document);
    }
}
