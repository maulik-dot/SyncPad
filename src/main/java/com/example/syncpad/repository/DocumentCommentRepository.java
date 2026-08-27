package com.example.syncpad.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentComment;

@Repository
public interface DocumentCommentRepository extends JpaRepository<DocumentComment, Long> {
    List<DocumentComment> findByDocumentAndParentIsNullOrderByCreatedAtAsc(Document document);
    List<DocumentComment> findByDocumentOrderByCreatedAtAsc(Document document);
    void deleteByDocument(Document document);
    long countByDocument(Document document);
    long countByDocumentAndResolvedFalse(Document document);
}
