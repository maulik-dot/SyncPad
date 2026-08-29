package com.example.syncpad.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.syncpad.dto.request.AiGenerateRequest;
import com.example.syncpad.dto.response.AiGenerateResponse;
import com.example.syncpad.entity.AiActionType;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

class AiAssistantServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private DocumentPermissionRepository permissionRepository;

    @Mock
    private WorkspacePermissionRepository workspacePermissionRepository;

    private AiAssistantService aiAssistantService;

    private User testUser;
    private Document testDocument;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        aiAssistantService = new AiAssistantService(
                documentRepository,
                userRepository,
                workspaceRepository,
                permissionRepository,
                workspacePermissionRepository
        );

        testUser = new User();
        testUser.setId(1L);
        testUser.setEmail("author@syncpad.com");
        testUser.setName("Author User");

        testDocument = new Document();
        testDocument.setId(100L);
        testDocument.setTitle("Architecture Guide");
        testDocument.setContent("<p>SyncPad handles real-time concurrency with WebSockets and Spring Boot.</p>");
        testDocument.setOwner(testUser);

        when(userRepository.findByEmail("author@syncpad.com")).thenReturn(Optional.of(testUser));
        when(documentRepository.findById(100L)).thenReturn(Optional.of(testDocument));
    }

    @Test
    void getAvailableActions_returnsStandardCatalog() {
        var actions = aiAssistantService.getAvailableActions();
        assertNotNull(actions);
        assertFalse(actions.isEmpty());
        assertTrue(actions.stream().anyMatch(a -> a.getAction() == AiActionType.SUMMARIZE));
        assertTrue(actions.stream().anyMatch(a -> a.getAction() == AiActionType.ACTION_ITEMS));
    }

    @Test
    void generate_summarize_returnsStructuredSummary() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.SUMMARIZE);
        AiGenerateResponse response = aiAssistantService.generate(request, "author@syncpad.com");

        assertNotNull(response);
        assertEquals(AiActionType.SUMMARIZE, response.getAction());
        assertNotNull(response.getText());
        assertTrue(response.getText().contains("Executive Summary"));
        assertTrue(response.getEstimatedTokens() > 0);
    }

    @Test
    void generate_actionItems_returnsChecklist() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.ACTION_ITEMS);
        AiGenerateResponse response = aiAssistantService.generate(request, "author@syncpad.com");

        assertNotNull(response);
        assertEquals(AiActionType.ACTION_ITEMS, response.getAction());
        assertTrue(response.getText().contains("- [ ]"));
    }

    @Test
    void generate_unauthorizedUser_throwsPermissionDenied() {
        User outsider = new User();
        outsider.setId(2L);
        outsider.setEmail("outsider@syncpad.com");

        when(userRepository.findByEmail("outsider@syncpad.com")).thenReturn(Optional.of(outsider));
        when(permissionRepository.findByUserAndDocument(outsider, testDocument)).thenReturn(Optional.empty());

        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.SUMMARIZE);

        assertThrows(PermissionDeniedException.class, () ->
                aiAssistantService.generate(request, "outsider@syncpad.com")
        );
    }

    @Test
    void generate_translate_supportsLanguageTarget() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.TRANSLATE);
        request.setTargetLanguage("French");

        AiGenerateResponse response = aiAssistantService.generate(request, "author@syncpad.com");
        assertNotNull(response);
        assertTrue(response.getText().contains("espace de travail"));
    }

    @Test
    void streamGenerate_returnsValidEmitter() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.SUMMARIZE);
        SseEmitter emitter = aiAssistantService.streamGenerate(request, "author@syncpad.com");

        assertNotNull(emitter);
    }
}

