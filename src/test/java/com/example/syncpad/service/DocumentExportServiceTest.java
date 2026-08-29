package com.example.syncpad.service;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.FileType;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentCommentRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

@ExtendWith(MockitoExtension.class)
public class DocumentExportServiceTest {

    @Mock private DocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private WorkspaceRepository workspaceRepository;
    @Mock private DocumentPermissionRepository permissionRepository;
    @Mock private WorkspacePermissionRepository workspacePermissionRepository;
    @Mock private DocumentCommentRepository commentRepository;
    @Mock private AuditLogService auditLogService;

    private DocumentExportService exportService;

    private User owner;
    private Document doc;

    @BeforeEach
    public void setup() {
        exportService = new DocumentExportService(
                documentRepository,
                userRepository,
                workspaceRepository,
                permissionRepository,
                workspacePermissionRepository,
                commentRepository,
                auditLogService
        );

        owner = new User("Alice", "alice@example.com", "hash");
        owner.setId(1L);

        doc = new Document("Architecture RFC", "# Architecture Overview\n\nDetails of microservices.", FileType.DOC, null, null, owner);
        doc.setId(10L);
    }

    @Test
    public void testExportMarkdown_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));

        ResponseEntity<byte[]> response = exportService.exportDocument(10L, "md", "alice@example.com");
        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("Architecture_RFC.md"));

        String text = new String(response.getBody(), StandardCharsets.UTF_8);
        assertTrue(text.startsWith("# Architecture RFC"));
        assertTrue(text.contains("Details of microservices"));
        verify(auditLogService).log(eq(owner), any(), eq(doc), eq("DOCUMENT_EXPORTED"), anyString());
    }

    @Test
    public void testExportHtml_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));

        ResponseEntity<byte[]> response = exportService.exportDocument(10L, "html", "alice@example.com");
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("Architecture_RFC.html"));

        String html = new String(response.getBody(), StandardCharsets.UTF_8);
        assertTrue(html.contains("<!DOCTYPE html>"));
        assertTrue(html.contains("Architecture RFC - SyncPad"));
    }

    @Test
    public void testExportJson_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));
        when(commentRepository.countByDocument(doc)).thenReturn(3L);

        ResponseEntity<byte[]> response = exportService.exportDocument(10L, "json", "alice@example.com");
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("Architecture_RFC.json"));

        String json = new String(response.getBody(), StandardCharsets.UTF_8);
        assertTrue(json.contains("\"title\" : \"Architecture RFC\""));
        assertTrue(json.contains("\"commentCount\" : 3"));
    }

    @Test
    public void testExportZip_Success() {
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));

        ResponseEntity<byte[]> response = exportService.exportDocument(10L, "zip", "alice@example.com");
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getHeaders().getFirst("Content-Disposition").contains("Architecture_RFC-bundle.zip"));
        assertTrue(response.getBody().length > 0);
    }

    @Test
    public void testExport_Unauthorized_ThrowsForbidden() {
        User mallory = new User("Mallory", "mallory@example.com", "hash");
        mallory.setId(99L);

        when(userRepository.findByEmail("mallory@example.com")).thenReturn(Optional.of(mallory));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));

        assertThrows(PermissionDeniedException.class, () ->
                exportService.exportDocument(10L, "md", "mallory@example.com"));
    }
}
