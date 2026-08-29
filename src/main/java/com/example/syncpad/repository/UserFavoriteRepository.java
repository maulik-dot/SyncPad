package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.UserFavorite;

@Repository
public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {

    List<UserFavorite> findByUserIdAndDocumentIsNotNullOrderByCreatedAtDesc(Long userId);

    Optional<UserFavorite> findByUserIdAndDocumentId(Long userId, Long documentId);

    boolean existsByUserIdAndDocumentId(Long userId, Long documentId);

    void deleteByUserIdAndDocumentId(Long userId, Long documentId);

    void deleteByDocument(Document document);
}