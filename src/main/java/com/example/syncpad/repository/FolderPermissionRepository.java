package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Folder;
import com.example.syncpad.entity.FolderPermission;
import com.example.syncpad.entity.User;

@Repository
public interface FolderPermissionRepository extends JpaRepository<FolderPermission, Long> {
    
    Optional<FolderPermission> findByUserAndFolder(User user, Folder folder);
    
    Optional<FolderPermission> findByUserIdAndFolderId(Long userId, Long folderId);
    
    List<FolderPermission> findByUser(User user);
    
    List<FolderPermission> findByFolder(Folder folder);

    void deleteByFolder(Folder folder);
}
