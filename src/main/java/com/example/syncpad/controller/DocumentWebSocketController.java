package com.example.syncpad.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;

import com.example.syncpad.dto.message.DocumentEditMessage;
import java.util.concurrent.ConcurrentHashMap;
import com.example.syncpad.crdt.CrdtDocumentEngine;
import com.example.syncpad.crdt.CrdtOperation;
import com.example.syncpad.service.DocumentService;

@Controller
public class DocumentWebSocketController {

    private final DocumentService documentService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConcurrentHashMap<Long, CrdtDocumentEngine> crdtEngines = new ConcurrentHashMap<>();

    public DocumentWebSocketController(DocumentService documentService, SimpMessagingTemplate messagingTemplate) {
        this.documentService = documentService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/documents/{documentId}/crdt")
    public void handleCrdtOperation(
            @DestinationVariable Long documentId,
            @Payload CrdtOperation operation,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket CRDT operation");
        }
        String senderEmail = principal.getName();
        documentService.assertCanEditDocument(documentId, senderEmail);

        operation.setSenderEmail(senderEmail);
        operation.setDocumentId(documentId);

        // Update server-side CRDT state
        CrdtDocumentEngine engine = crdtEngines.computeIfAbsent(documentId, id -> {
            CrdtDocumentEngine newEngine = new CrdtDocumentEngine(id);
            try {
                var doc = documentService.getDocument(id, senderEmail);
                if (doc != null && doc.getContent() != null) {
                    newEngine.loadFromText(doc.getContent(), "server");
                }
            } catch (Exception ignored) {}
            return newEngine;
        });

        engine.applyOperation(operation);

        // Broadcast character-level delta to all connected collaborators
        // NOTE: dot-style topics only — RabbitMQ STOMP relay rejects '/' in topic names.
        messagingTemplate.convertAndSend("/topic/documents." + documentId + ".crdt", operation);
    }

    @MessageMapping("/documents/{documentId}/edit")
    public void handleDocumentEdit(
            @DestinationVariable Long documentId,
            @Payload DocumentEditMessage message,
            Principal principal,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket edit operation");
        }
        String senderEmail = principal.getName();
        documentService.assertCanEditDocument(documentId, senderEmail);

        message.setSenderEmail(senderEmail);
        message.setDocumentId(documentId);

        messagingTemplate.convertAndSend("/topic/documents." + documentId, message);
    }

    @MessageMapping("/documents/{documentId}/save")
    public void handleDocumentSave(
            @DestinationVariable Long documentId,
            @Payload DocumentEditMessage message,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket save operation");
        }
        String senderEmail = principal.getName();
        documentService.assertCanEditDocument(documentId, senderEmail);
        documentService.updateDocument(documentId, message.getTitle(), message.getContent(), senderEmail);

        message.setSenderEmail(senderEmail);
        message.setDocumentId(documentId);
        message.setType("SAVED");

        messagingTemplate.convertAndSend("/topic/documents." + documentId, message);
    }

    @MessageMapping("/documents/{documentId}/presence")
    public void handlePresence(
            @DestinationVariable Long documentId,
            @Payload Map<String, Object> message,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket presence operation");
        }
        String senderEmail = principal.getName();
        // Presence is view-level: any collaborator who can open the doc should be visible.
        documentService.getDocument(documentId, senderEmail);

        message.put("userEmail", senderEmail);
        message.put("documentId", documentId);
        message.put("timestamp", System.currentTimeMillis());

        if (!message.containsKey("role") || message.get("role") == null) {
            com.example.syncpad.entity.Role role = documentService.getUserEffectiveRole(documentId, senderEmail);
            if (role != null) {
                message.put("role", role.name());
            }
        }

        messagingTemplate.convertAndSend("/topic/documents." + documentId + ".presence", (Object) message);
    }

    @MessageMapping("/documents/{documentId}/pdf-annotation")
    public void handlePdfAnnotation(
            @DestinationVariable Long documentId,
            @Payload Map<String, Object> message,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket annotation operation");
        }
        String senderEmail = principal.getName();
        documentService.assertCanEditDocument(documentId, senderEmail);

        message.put("senderEmail", senderEmail);
        message.put("documentId", documentId);

        messagingTemplate.convertAndSend("/topic/documents." + documentId + ".pdf-annotations", (Object) message);
    }

    @MessageMapping("/documents/{documentId}/mention")
    public void handleDocumentMention(
            @DestinationVariable Long documentId,
            @Payload Map<String, Object> message,
            Principal principal
    ) {
        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("Unauthorized WebSocket mention operation");
        }
        String senderEmail = principal.getName();
        documentService.assertCanEditDocument(documentId, senderEmail);

        message.put("senderEmail", senderEmail);
        message.put("documentId", documentId);
        message.put("type", "MENTION");
        if (!message.containsKey("timestamp") || message.get("timestamp") == null) {
            message.put("timestamp", System.currentTimeMillis());
        }

        messagingTemplate.convertAndSend("/topic/documents." + documentId, (Object) message);

        String targetEmail = (String) message.get("mentionedEmail");
        Long targetUserId = null;
        if (message.get("mentionedUserId") != null) {
            try {
                targetUserId = Long.valueOf(message.get("mentionedUserId").toString());
            } catch (Exception ignored) {}
        }
        String targetName = (String) message.get("mentionedName");
        if (targetEmail != null && !targetEmail.isBlank()) {
            documentService.notifyCollaboratorMention(documentId, senderEmail, targetEmail, targetUserId, targetName);
        }
    }
}
