package com.example.syncpad.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentPermission;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.DocumentVersionRepository;
import com.example.syncpad.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
public class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DocumentPermissionRepository permissionRepository;

    @Mock
    private DocumentVersionRepository versionRepository;

    @InjectMocks
    private DocumentService documentService;

    @Test
    public void testCreateDocument_Success() {
        User owner = new User("Alice", "alice@example.com", "pass");
        owner.setId(1L);

        Document doc = new Document("Test Title", "Test Content", owner);
        doc.setId(10L);

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.save(any(Document.class))).thenReturn(doc);

        Document result = documentService.createDocument("Test Title", "Test Content", "alice@example.com");

        assertNotNull(result);
        assertEquals("Test Title", result.getTitle());
        verify(permissionRepository).save(any(DocumentPermission.class));
        verify(versionRepository).save(any());
    }

    @Test
    public void testGetDocument_PermissionDenied() {
        User bob = new User("Bob", "bob@example.com", "pass");
        Document doc = new Document("Secret", "Content", null);
        doc.setId(20L);

        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(bob));
        when(documentRepository.findById(20L)).thenReturn(Optional.of(doc));
        when(permissionRepository.findByUserAndDocument(bob, doc)).thenReturn(Optional.empty());

        assertThrows(PermissionDeniedException.class, () -> documentService.getDocument(20L, "bob@example.com"));
    }

    @Test
    public void testUpdateDocument_ViewerDenied() {
        User charlie = new User("Charlie", "charlie@example.com", "pass");
        Document doc = new Document("Doc", "Content", null);
        doc.setId(30L);

        DocumentPermission viewerPermission = new DocumentPermission(charlie, doc, Role.VIEWER);

        when(userRepository.findByEmail("charlie@example.com")).thenReturn(Optional.of(charlie));
        when(documentRepository.findById(30L)).thenReturn(Optional.of(doc));
        when(permissionRepository.findByUserAndDocument(charlie, doc)).thenReturn(Optional.of(viewerPermission));

        assertThrows(PermissionDeniedException.class, () ->
                documentService.updateDocument(30L, "New Title", "New Content", "charlie@example.com")
        );
    }

    @Test
    public void testSearchDocuments_SuccessAndFiltering() {
        User alice = new User("Alice", "alice@example.com", "pass");
        alice.setId(1L);

        Document doc1 = new Document("Architecture Blueprint", "Contains microservice details", alice);
        doc1.setId(101L);
        Document doc2 = new Document("Secret Memo", "Unauthorized notes", null);
        doc2.setId(102L);

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(alice));
        when(documentRepository.searchByTitleOrContent("microservice")).thenReturn(java.util.List.of(doc1, doc2));
        when(permissionRepository.findByUserAndDocument(alice, doc2)).thenReturn(Optional.empty());

        java.util.List<com.example.syncpad.dto.response.DocumentResponse> results =
                documentService.searchDocuments("microservice", "alice@example.com");

        assertEquals(1, results.size());
        assertEquals("Architecture Blueprint", results.get(0).getTitle());
    }
}
