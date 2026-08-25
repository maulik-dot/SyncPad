package com.example.syncpad.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import com.example.syncpad.dto.message.DocumentEditMessage;
import com.example.syncpad.service.DocumentService;

@Controller
public class DocumentWebSocketController {

    private final DocumentService documentService;

    public DocumentWebSocketController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @MessageMapping("/documents/{documentId}/edit")
    @SendTo("/topic/documents/{documentId}")
    public DocumentEditMessage handleDocumentEdit(
            @DestinationVariable Long documentId,
            @Payload DocumentEditMessage message,
            Principal principal,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String senderEmail = principal != null ? principal.getName() : message.getSenderEmail();
        message.setSenderEmail(senderEmail);
        message.setDocumentId(documentId);

        return message;
    }

    @MessageMapping("/documents/{documentId}/save")
    @SendTo("/topic/documents/{documentId}")
    public DocumentEditMessage handleDocumentSave(
            @DestinationVariable Long documentId,
            @Payload DocumentEditMessage message,
            Principal principal
    ) {
        String senderEmail = principal != null ? principal.getName() : message.getSenderEmail();
        if (senderEmail != null) {
            documentService.updateDocument(documentId, message.getTitle(), message.getContent(), senderEmail);
        }

        message.setSenderEmail(senderEmail);
        message.setDocumentId(documentId);
        message.setType("SAVED");
        return message;
    }

    @MessageMapping("/documents/{documentId}/pdf-annotation")
    @SendTo("/topic/documents/{documentId}/pdf-annotations")
    public java.util.Map<String, Object> handlePdfAnnotation(
            @DestinationVariable Long documentId,
            @Payload java.util.Map<String, Object> message,
            Principal principal
    ) {
        String senderEmail = principal != null ? principal.getName() : (String) message.get("senderEmail");
        message.put("senderEmail", senderEmail);
        message.put("documentId", documentId);
        return message;
    }
}
