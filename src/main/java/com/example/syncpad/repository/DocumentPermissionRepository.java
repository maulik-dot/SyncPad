package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentPermission;
import com.example.syncpad.entity.User;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermission, Long> {
    
    Optional<DocumentPermission> findByUserAndDocument(User user, Document document);
    
    Optional<DocumentPermission> findByUserIdAndDocumentId(Long userId, Long documentId);
    
    List<DocumentPermission> findByUser(User user);
    
    List<DocumentPermission> findByDocument(Document document);
}
