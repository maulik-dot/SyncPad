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

    @org.springframework.data.jpa.repository.Query("SELECT d FROM Document d WHERE d.isTrashed = false AND (LOWER(d.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(d.content) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Document> searchByTitleOrContent(@org.springframework.data.repository.query.Param("query") String query);
}

