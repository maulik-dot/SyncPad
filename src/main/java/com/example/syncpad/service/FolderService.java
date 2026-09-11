package com.example.syncpad.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.response.PermissionResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.FolderPermission;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.FolderPermissionRepository;
import com.example.syncpad.repository.FolderRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class FolderService {

    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final FolderPermissionRepository folderPermissionRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final com.example.syncpad.repository.DocumentRepository documentRepository;

    public FolderService(
            FolderRepository folderRepository,
            UserRepository userRepository,
            FolderPermissionRepository folderPermissionRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            com.example.syncpad.repository.DocumentRepository documentRepository
    ) {
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.folderPermissionRepository = folderPermissionRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.documentRepository = documentRepository;
    }

    public Role getEffectiveRole(Folder folder, User user) {
        if (folder == null || user == null) return null;

        // 1. Folder Owner has full OWNER rights
        if (folder.getOwner() != null && folder.getOwner().getId().equals(user.getId())) {
            return Role.OWNER;
        }

        // 2. Check explicit FolderPermission override for this user
        Optional<FolderPermission> explicit = folderPermissionRepository.findByUserAndFolder(user, folder);
        if (explicit.isPresent()) {
            Role explicitRole = explicit.get().getRole();
            if (explicitRole == Role.RESTRICTED) {
                return null; // Explicitly restricted from access
            }
            return explicitRole;
        }

        // 3. Check parent folder hierarchy
        if (folder.getParentFolder() != null) {
            Role parentRole = getEffectiveRole(folder.getParentFolder(), user);
            if (parentRole == null) {
                return null; // Restricted at parent folder level
            }
        }

        // 4. Check Workspace-level permission
        String wsName = folder.getWorkspaceName();
        if (wsName != null && !wsName.isBlank()) {
            List<Workspace> wsList = workspaceRepository.findAllByName(wsName.trim());
            for (Workspace ws : wsList) {
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

    public boolean isUserFolderAdmin(Folder folder, User user) {
        if (folder == null || user == null) return false;

        // Folder owner is admin
        if (folder.getOwner() != null && folder.getOwner().getId().equals(user.getId())) {
            return true;
        }

        // Workspace owner / admin is folder admin
        String wsName = folder.getWorkspaceName();
        if (wsName != null && !wsName.isBlank()) {
            List<Workspace> wsList = workspaceRepository.findAllByName(wsName.trim());
            for (Workspace ws : wsList) {
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return true;
                }
                Optional<WorkspacePermission> wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent() && (wsPerm.get().getRole() == Role.OWNER || wsPerm.get().getRole() == Role.ADMIN)) {
                    return true;
                }
            }
        }

        Optional<FolderPermission> explicit = folderPermissionRepository.findByUserAndFolder(user, folder);
        return explicit.map(p -> p.getRole() == Role.OWNER || p.getRole() == Role.ADMIN).orElse(false);
    }

    @Transactional
    public Folder createFolder(String name, String workspaceName, Long parentFolderId, String userEmail) {
        User owner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Folder parentFolder = null;
        if (parentFolderId != null) {
            parentFolder = folderRepository.findById(parentFolderId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent folder not found"));
            if (getEffectiveRole(parentFolder, owner) == null) {
                throw new PermissionDeniedException("Access restricted: You do not have permission to create folders inside this folder");
            }
            if (workspaceName == null || workspaceName.isBlank()) {
                workspaceName = parentFolder.getWorkspaceName();
            }
        }

        if (workspaceName != null && !workspaceName.isBlank()) {
            String trimmedWs = workspaceName.trim();
            List<Workspace> wsList = workspaceRepository.findAllByName(trimmedWs);
            if (!wsList.isEmpty()) {
                boolean hasWsPerm = wsList.stream().anyMatch(ws -> {
                    boolean isWsOwner = ws.getOwner() != null && ws.getOwner().getId().equals(owner.getId());
                    boolean hasPerm = workspacePermissionRepository.findByUserAndWorkspace(owner, ws)
                            .map(p -> p.getRole() == Role.OWNER || p.getRole() == Role.ADMIN || p.getRole() == Role.EDITOR)
                            .orElse(false);
                    return isWsOwner || hasPerm;
                });
                if (!hasWsPerm) {
                    throw new PermissionDeniedException("Access restricted: You do not have permission to add folders to this workspace");
                }
            }
        }

        Folder folder = new Folder(name, workspaceName, parentFolder, owner);
        return folderRepository.save(folder);
    }

    @Transactional
    public Folder updateFolder(Long id, String name, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Folder folder = folderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + id));

        Role role = getEffectiveRole(folder, user);
        if (role == null || role == Role.VIEWER) {
            throw new PermissionDeniedException("You do not have permission to edit this folder");
        }

        if (name != null && !name.isBlank()) {
            folder.setName(name);
        }
        return folderRepository.save(folder);
    }

    @Transactional
    public void deleteFolder(Long id, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Folder folder = folderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + id));

        if (!isUserFolderAdmin(folder, user)) {
            throw new PermissionDeniedException("Only Folder or Workspace Admin can delete this folder");
        }

        // 1. Recursively delete subfolders first
        List<Folder> subfolders = folderRepository.findByParentFolderId(folder.getId());
        for (Folder sub : subfolders) {
            sub.setParentFolder(null);
            folderRepository.save(sub);
            deleteFolder(sub.getId(), userEmail);
        }

        // 2. Detach any documents directly inside this folder so they safely move to the root workspace level
        if (documentRepository != null) {
            List<Document> docsInFolder = documentRepository.findByFolderId(folder.getId());
            for (Document doc : docsInFolder) {
                doc.setFolder(null);
                documentRepository.save(doc);
            }
        }

        // 3. Clear parent reference and delete
        folder.setParentFolder(null);
        folderRepository.save(folder);
        folderPermissionRepository.deleteByFolder(folder);
        folderRepository.delete(folder);
    }

    public List<Folder> getFoldersByWorkspace(String workspaceName, String userEmail) {
        User user = (userEmail != null && !userEmail.isBlank()) 
                ? userRepository.findByEmail(userEmail).orElse(null) 
                : null;

        List<Folder> allWorkspaceFolders = folderRepository.findByWorkspaceName(workspaceName);
        if (allWorkspaceFolders.isEmpty() && workspaceName != null && !workspaceName.isBlank()) {
            final String trimmedTarget = workspaceName.trim();
            allWorkspaceFolders = folderRepository.findAll().stream()
                    .filter(f -> f.getWorkspaceName() != null && f.getWorkspaceName().trim().equalsIgnoreCase(trimmedTarget))
                    .collect(Collectors.toList());
        }
        if (user == null) {
            return allWorkspaceFolders;
        }

        return allWorkspaceFolders.stream()
                .filter(folder -> getEffectiveRole(folder, user) != null)
                .collect(Collectors.toList());
    }

    public List<Folder> getUserFolders(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        List<Folder> allFolders = folderRepository.findAll();
        return allFolders.stream()
                .filter(folder -> getEffectiveRole(folder, user) != null)
                .collect(Collectors.toList());
    }

    public Folder getFolder(Long id, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + userEmail));

        Folder folder = folderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + id));

        Role role = getEffectiveRole(folder, user);
        if (role == null) {
            throw new PermissionDeniedException("Access restricted: You do not have permission to access this folder");
        }
        return folder;
    }

    public List<Folder> getSubfolders(Long parentFolderId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Folder parentFolder = folderRepository.findById(parentFolderId)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + parentFolderId));

        if (getEffectiveRole(parentFolder, user) == null) {
            throw new PermissionDeniedException("Access restricted: You do not have permission to view this folder");
        }

        return folderRepository.findByParentFolderId(parentFolderId).stream()
                .filter(sub -> getEffectiveRole(sub, user) != null)
                .collect(Collectors.toList());
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    public List<PermissionResponse> getFolderPermissions(Long folderId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + requesterEmail));

        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + folderId));

        if (!isUserFolderAdmin(folder, requester)) {
            throw new PermissionDeniedException("Only Folder or Workspace Admin can manage folder permissions");
        }

        List<FolderPermission> explicitPerms = folderPermissionRepository.findByFolder(folder);
        Set<Long> processedUserIds = new HashSet<>();
        List<PermissionResponse> result = new ArrayList<>();

        // Add explicit overrides
        for (FolderPermission fp : explicitPerms) {
            result.add(new PermissionResponse(
                    fp.getId(),
                    fp.getUser().getId(),
                    fp.getUser().getName(),
                    fp.getUser().getEmail(),
                    fp.getRole()
            ));
            processedUserIds.add(fp.getUser().getId());
        }

        // Add workspace members who don't have an explicit override
        String wsName = folder.getWorkspaceName();
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
    public FolderPermission updateFolderPermission(Long folderId, Long targetUserId, String targetEmail, Role role, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + requesterEmail));

        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + folderId));

        if (!isUserFolderAdmin(folder, requester)) {
            throw new PermissionDeniedException("Only Folder or Workspace Admin can manage folder permissions");
        }

        User targetUser = null;
        if (targetUserId != null) {
            targetUser = userRepository.findById(targetUserId).orElse(null);
        }
        if (targetUser == null && targetEmail != null && !targetEmail.isBlank()) {
            targetUser = userRepository.findByEmail(targetEmail).orElse(null);
        }
        if (targetUser == null) {
            throw new RuntimeException("Target user not found");
        }

        if (folder.getOwner() != null && folder.getOwner().getId().equals(targetUser.getId())) {
            throw new PermissionDeniedException("Cannot restrict or modify permissions for Folder Owner");
        }

        final User finalTargetUser = targetUser;
        Optional<FolderPermission> existing = folderPermissionRepository.findByUserAndFolder(finalTargetUser, folder);
        if (role == null) {
            existing.ifPresent(folderPermissionRepository::delete);
            return null;
        }

        FolderPermission perm = existing.orElseGet(() -> new FolderPermission(finalTargetUser, folder, role));
        perm.setRole(role);
        return folderPermissionRepository.save(perm);
    }

    @Transactional
    public void removeFolderPermission(Long folderId, Long targetUserId, String requesterEmail) {
        User requester = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found: " + requesterEmail));

        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new RuntimeException("Folder not found: " + folderId));

        if (!isUserFolderAdmin(folder, requester)) {
            throw new PermissionDeniedException("Only Folder or Workspace Admin can remove permissions");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found: " + targetUserId));

        folderPermissionRepository.findByUserAndFolder(targetUser, folder)
                .ifPresent(folderPermissionRepository::delete);
    }
}
