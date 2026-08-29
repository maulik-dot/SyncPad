package com.example.syncpad.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.DocumentTemplate;

@Repository
public interface TemplateRepository extends JpaRepository<DocumentTemplate, Long> {
    List<DocumentTemplate> findByIsBuiltinTrueOrderByTitleAsc();
    List<DocumentTemplate> findByWorkspaceIdOrderByCreatedAtDesc(Long workspaceId);
}
