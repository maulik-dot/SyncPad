package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.syncpad.dto.request.AiGenerateRequest;
import com.example.syncpad.dto.response.AiGenerateResponse;
import com.example.syncpad.dto.response.AiGenerationResponse;
import com.example.syncpad.entity.AiActionType;
import com.example.syncpad.entity.AiGeneration;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.User;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.AiGenerationRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

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

    @Mock
    private AiGenerationRepository aiGenerationRepository;

    @Mock
    private AuditLogService auditLogService;

    private MeterRegistry meterRegistry;
    private AiAssistantService aiAssistantService;

    private User testUser;
    private Document testDocument;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        meterRegistry = new SimpleMeterRegistry();

        aiAssistantService = new AiAssistantService(
                documentRepository,
                userRepository,
                workspaceRepository,
                permissionRepository,
                workspacePermissionRepository,
                aiGenerationRepository,
                auditLogService,
                meterRegistry
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
    void generate_summarize_returnsStructuredSummary_andPersistsAndCountsMetrics() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.SUMMARIZE);
        request.setTone("casual");

        AiGenerateResponse response = aiAssistantService.generate(request, "author@syncpad.com");

        assertNotNull(response);
        assertEquals(AiActionType.SUMMARIZE, response.getAction());
        assertNotNull(response.getText());
        assertTrue(response.getText().contains("Executive Summary"));
        assertTrue(response.getEstimatedTokens() > 0);

        // Verify persistence (Option A)
        ArgumentCaptor<AiGeneration> captor = ArgumentCaptor.forClass(AiGeneration.class);
        verify(aiGenerationRepository).save(captor.capture());
        AiGeneration saved = captor.getValue();
        assertEquals(testUser, saved.getUser());
        assertEquals("author@syncpad.com", saved.getUserEmail());
        assertEquals(testDocument, saved.getDocument());
        assertEquals(AiActionType.SUMMARIZE, saved.getAction());
        assertEquals("casual", saved.getTone());
        assertFalse(saved.isStream());
        assertNotNull(saved.getResponseText());

        // Verify Prometheus metrics (Option D)
        var counter = meterRegistry.find("ai.requests.total")
                .tags("action", "SUMMARIZE", "mode", "sync", "status", "success")
                .counter();
        assertNotNull(counter);
        assertEquals(1.0, counter.count());

        var timer = meterRegistry.find("ai.request.duration")
                .tags("action", "SUMMARIZE", "mode", "sync")
                .timer();
        assertNotNull(timer);
        assertEquals(1, timer.count());

        var tokenCounter = meterRegistry.find("ai.tokens.estimated")
                .tags("action", "SUMMARIZE")
                .counter();
        assertNotNull(tokenCounter);
        assertTrue(tokenCounter.count() > 0);

        // Verify Audit Log
        verify(auditLogService).log(eq(testUser), any(), eq(testDocument), eq("AI_ACTION_SUMMARIZE"), any());
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
    void generate_handlesExcessiveSelectedText_withoutError() {
        String hugeText = "A".repeat(12000);
        AiGenerateRequest request = new AiGenerateRequest(100L, null, hugeText, AiActionType.SUMMARIZE);

        AiGenerateResponse response = aiAssistantService.generate(request, "author@syncpad.com");
        assertNotNull(response);

        ArgumentCaptor<AiGeneration> captor = ArgumentCaptor.forClass(AiGeneration.class);
        verify(aiGenerationRepository).save(captor.capture());
        assertTrue(captor.getValue().getSelectedText().contains("[truncated to 8000 characters]"));
    }

    @Test
    void streamGenerate_returnsValidEmitter() {
        AiGenerateRequest request = new AiGenerateRequest(100L, null, null, AiActionType.SUMMARIZE);
        SseEmitter emitter = aiAssistantService.streamGenerate(request, "author@syncpad.com");

        assertNotNull(emitter);
    }

    @Test
    void getHistory_forDocument_authorized_returnsHistory() {
        AiGeneration gen = new AiGeneration(testUser, "author@syncpad.com", testDocument,
                AiActionType.SUMMARIZE, "SyncPad Contextual Synthesis", "prompt", "selected",
                "response text", "formal", 40, 120L, false);
        gen.setId(55L);
        gen.setCreatedAt(LocalDateTime.now());

        Pageable pageable = PageRequest.of(0, 10);
        when(aiGenerationRepository.findByDocumentIdOrderByCreatedAtDesc(100L, pageable))
                .thenReturn(new PageImpl<>(List.of(gen), pageable, 1));

        Page<AiGenerationResponse> result = aiAssistantService.getHistory(100L, "author@syncpad.com", pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(55L, result.getContent().get(0).getId());
        assertEquals(100L, result.getContent().get(0).getDocumentId());
        assertEquals(AiActionType.SUMMARIZE, result.getContent().get(0).getAction());
        assertEquals("formal", result.getContent().get(0).getTone());
    }

    @Test
    void getHistory_forDocument_unauthorized_throwsPermissionDenied() {
        User outsider = new User();
        outsider.setId(2L);
        outsider.setEmail("outsider@syncpad.com");

        when(userRepository.findByEmail("outsider@syncpad.com")).thenReturn(Optional.of(outsider));
        when(permissionRepository.findByUserAndDocument(outsider, testDocument)).thenReturn(Optional.empty());

        Pageable pageable = PageRequest.of(0, 10);
        assertThrows(PermissionDeniedException.class, () ->
                aiAssistantService.getHistory(100L, "outsider@syncpad.com", pageable)
        );
    }

    @Test
    void getHistory_forUser_whenDocumentNull_returnsUserHistory() {
        AiGeneration gen = new AiGeneration(testUser, "author@syncpad.com", null,
                AiActionType.CUSTOM, "SyncPad Contextual Synthesis", "my prompt", null,
                "response text", null, 25, 80L, false);
        gen.setId(77L);

        Pageable pageable = PageRequest.of(0, 10);
        when(aiGenerationRepository.findByUserEmailOrderByCreatedAtDesc("author@syncpad.com", pageable))
                .thenReturn(new PageImpl<>(List.of(gen), pageable, 1));

        Page<AiGenerationResponse> result = aiAssistantService.getHistory(null, "author@syncpad.com", pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(77L, result.getContent().get(0).getId());
        assertEquals(AiActionType.CUSTOM, result.getContent().get(0).getAction());
    }
}
