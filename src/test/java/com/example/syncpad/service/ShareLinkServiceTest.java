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

import com.example.syncpad.dto.request.CreateShareLinkRequest;
import com.example.syncpad.dto.response.ShareLinkResponse;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.DocumentPermission;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.ShareLink;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.DocumentVersionRepository;
import com.example.syncpad.repository.ShareLinkRepository;
import com.example.syncpad.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
public class ShareLinkServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DocumentPermissionRepository permissionRepository;

    @Mock
    private DocumentVersionRepository versionRepository;

    @Mock
    private ShareLinkRepository shareLinkRepository;

    @InjectMocks
    private DocumentService documentService;

    @Test
    public void testGenerateShareLinkSuccess() {
        User owner = new User("Alice", "alice@example.com", "pass");
        owner.setId(1L);
        Document doc = new Document("Test Doc", "Content", owner);
        doc.setId(10L);

        DocumentPermission perm = new DocumentPermission(owner, doc, Role.OWNER);

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(owner));
        when(documentRepository.findById(10L)).thenReturn(Optional.of(doc));
        when(permissionRepository.findByUserAndDocument(owner, doc)).thenReturn(Optional.of(perm));
        when(shareLinkRepository.findByDocumentAndActiveTrue(doc)).thenReturn(Optional.empty());
        when(shareLinkRepository.save(any(ShareLink.class))).thenAnswer(i -> i.getArgument(0));

        CreateShareLinkRequest req = new CreateShareLinkRequest(Role.VIEWER, 7);
        ShareLinkResponse response = documentService.generateShareLink(10L, "alice@example.com", req);

        assertNotNull(response);
        assertEquals(Role.VIEWER, response.getRole());
        assertNotNull(response.getToken());
        verify(shareLinkRepository).save(any(ShareLink.class));
    }

    @Test
    public void testGetDocumentByShareTokenRevokedThrowsException() {
        User owner = new User("Alice", "alice@example.com", "pass");
        Document doc = new Document("Test Doc", "Content", owner);
        ShareLink link = new ShareLink(doc, "token123", Role.VIEWER, null);
        link.setActive(false);

        when(shareLinkRepository.findByToken("token123")).thenReturn(Optional.of(link));

        assertThrows(PermissionDeniedException.class, () -> {
            documentService.getDocumentByShareToken("token123", null);
        });
    }
}
