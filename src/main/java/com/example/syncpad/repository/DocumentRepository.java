package com.example.syncpad.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;

public interface DocumentRepository extends JpaRepository<Document, Long>{
    List<Document> findByOwnerId(Long ownerId);
    List<Document> findByOwnerIdAndFileTypeAndIsTrashedFalse(Long ownerId, FileType fileType);
    List<Document> findByOwnerIdAndIsTrashedFalse(Long ownerId);
    List<Document> findByFolderId(Long folderId);
    List<Document> findByWorkspaceName(String workspaceName);
}

