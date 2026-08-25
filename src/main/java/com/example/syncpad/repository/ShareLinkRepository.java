package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.ShareLink;

@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, Long> {
    Optional<ShareLink> findByToken(String token);
    Optional<ShareLink> findByDocumentAndActiveTrue(Document document);
    List<ShareLink> findByDocument(Document document);
    void deleteByDocument(Document document);
}
