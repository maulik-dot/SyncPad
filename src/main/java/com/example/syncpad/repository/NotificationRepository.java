package com.example.syncpad.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.syncpad.entity.Notification;
import com.example.syncpad.entity.NotificationStatus;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientEmailOrderByCreatedAtDesc(String email);
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);
    long countByRecipientEmailAndIsReadFalse(String email);
    Optional<Notification> findByWorkspaceAndRecipientAndStatus(Workspace workspace, User recipient, NotificationStatus status);
    List<Notification> findByWorkspace(Workspace workspace);
    void deleteByRecipientEmail(String email);
    void deleteByRecipient(User recipient);
    void deleteByWorkspace(Workspace workspace);
}
