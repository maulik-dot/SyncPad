package com.example.syncpad.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Folder;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {
    List<Folder> findByWorkspaceName(String workspaceName);
    List<Folder> findByWorkspaceNameAndOwnerEmail(String workspaceName, String email);
    List<Folder> findByWorkspaceNameAndOwnerId(String workspaceName, Long ownerId);
    List<Folder> findByParentFolderId(Long parentFolderId);
    List<Folder> findByOwnerId(Long ownerId);
    List<Folder> findByOwnerEmail(String email);
}
