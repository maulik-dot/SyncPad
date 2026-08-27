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
import com.example.syncpad.service.DocumentService;

@Controller
public class DocumentWebSocketController {

    private final DocumentService documentService;
    private final SimpMessagingTemplate messagingTemplate;

    public DocumentWebSocketController(DocumentService documentService, SimpMessagingTemplate messagingTemplate) {
        this.documentService = documentService;
        this.messagingTemplate = messagingTemplate;
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
        documentService.assertCanEditDocument(documentId, senderEmail);

        message.put("userEmail", senderEmail);
        message.put("documentId", documentId);
        message.put("timestamp", System.currentTimeMillis());

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
}
