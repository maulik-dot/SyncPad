package com.example.syncpad.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.AiGeneration;

@Repository
public interface AiGenerationRepository extends JpaRepository<AiGeneration, Long> {
    Page<AiGeneration> findByDocumentIdOrderByCreatedAtDesc(Long documentId, Pageable pageable);
    Page<AiGeneration> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<AiGeneration> findByUserEmailOrderByCreatedAtDesc(String userEmail, Pageable pageable);
    Page<AiGeneration> findByDocumentIdAndUserEmailOrderByCreatedAtDesc(Long documentId, String userEmail, Pageable pageable);
}
