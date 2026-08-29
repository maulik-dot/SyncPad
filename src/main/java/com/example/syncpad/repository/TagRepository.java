package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Tag;

@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {

    List<Tag> findByWorkspaceIdOrderByNameAsc(Long workspaceId);

    Optional<Tag> findByWorkspaceIdAndNameIgnoreCase(Long workspaceId, String name);

    Optional<Tag> findByWorkspaceIsNullAndNameIgnoreCase(String name);

    boolean existsByWorkspaceIdAndNameIgnoreCase(Long workspaceId, String name);
}