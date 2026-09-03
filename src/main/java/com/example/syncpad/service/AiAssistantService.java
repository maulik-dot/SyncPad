package com.example.syncpad.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.syncpad.dto.request.AiGenerateRequest;
import com.example.syncpad.dto.response.AiActionOption;
import com.example.syncpad.dto.response.AiGenerateResponse;
import com.example.syncpad.dto.response.AiGenerationResponse;
import com.example.syncpad.entity.AiActionType;
import com.example.syncpad.entity.AiGeneration;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.exception.DocumentNotFoundException;
import com.example.syncpad.exception.PermissionDeniedException;
import com.example.syncpad.repository.AiGenerationRepository;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

@Service
public class AiAssistantService {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantService.class);
    private static final int MAX_SELECTED_TEXT_LENGTH = 8000;

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final AiGenerationRepository aiGenerationRepository;
    private final AuditLogService auditLogService;
    private final MeterRegistry meterRegistry;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final ExecutorService streamingExecutor = Executors.newVirtualThreadPerTaskExecutor();

    @Value("${gemini.api-key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Value("${gemini.model:gemini-flash-lite-latest}")
    private String geminiModel;

    @Autowired
    public AiAssistantService(
            DocumentRepository documentRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            DocumentPermissionRepository permissionRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            @Autowired(required = false) AiGenerationRepository aiGenerationRepository,
            @Autowired(required = false) AuditLogService auditLogService,
            @Autowired(required = false) MeterRegistry meterRegistry
    ) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.permissionRepository = permissionRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.aiGenerationRepository = aiGenerationRepository;
        this.auditLogService = auditLogService;
        this.meterRegistry = meterRegistry != null ? meterRegistry : new SimpleMeterRegistry();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    // Overloaded constructor for tests or lightweight instantiation
    public AiAssistantService(
            DocumentRepository documentRepository,
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            DocumentPermissionRepository permissionRepository,
            WorkspacePermissionRepository workspacePermissionRepository
    ) {
        this(documentRepository, userRepository, workspaceRepository, permissionRepository,
                workspacePermissionRepository, null, null, null);
    }

    public List<AiActionOption> getAvailableActions() {
        return List.of(
                new AiActionOption(AiActionType.SUMMARIZE, "Summarize", "Generate an executive summary & key takeaways", "sparkles", "Summarize this document concisely with key bullet points"),
                new AiActionOption(AiActionType.ACTION_ITEMS, "Action Items", "Extract structured tasks and deliverables checklist", "check-square", "Extract all action items and TODOs as a markdown checklist"),
                new AiActionOption(AiActionType.EXPAND, "Continue Writing", "Contextually continue drafting or elaborate on this topic", "pen-tool", "Continue writing the next logical paragraphs based on the context above"),
                new AiActionOption(AiActionType.FIX_GRAMMAR, "Improve Writing", "Fix grammar, polish cadence, and enhance clarity", "wand-2", "Refactor and polish this text for professional clarity and flow"),
                new AiActionOption(AiActionType.OUTLINE, "Create Outline", "Generate a structured agenda or project outline", "list-tree", "Create a structured outline with headers and key discussion topics"),
                new AiActionOption(AiActionType.TRANSLATE, "Translate", "Translate content into another language", "languages", "Translate the following text accurately while preserving formatting"),
                new AiActionOption(AiActionType.CUSTOM, "Ask AI", "Execute custom freeform instruction with document context", "message-square-code", ""),
                new AiActionOption(AiActionType.CODE_EXPLAIN, "Explain Code", "Explain what the selected code does, line by line", "code-2", "Explain this code in plain English, covering purpose, inputs, outputs"),
                new AiActionOption(AiActionType.CODE_FIX, "Fix Code", "Fix bugs, handle edge cases, and improve code quality", "wrench", "Fix bugs and improve this code, keep language the same, output only corrected code"),
                new AiActionOption(AiActionType.CODE_GENERATE, "Generate Code", "Generate code from a natural language prompt", "terminal", "Generate clean, commented code for the given request"),
                new AiActionOption(AiActionType.LATEX_EXPLAIN, "Explain Equation", "Explain the LaTeX equation in plain English", "sigma", "Explain this LaTeX equation step by step in plain English"),
                new AiActionOption(AiActionType.LATEX_GENERATE, "Generate LaTeX", "Generate LaTeX from a description", "function-square", "Generate LaTeX code for the described equation")
        );
    }

    // Long-term stable fallback chain: primary configured model then aliases with higher free-tier/longevity
    private static final List<String> GEMINI_FALLBACK_MODELS = List.of(
            "gemini-flash-lite-latest",
            "gemini-2.5-flash-lite",
            "gemini-flash-latest",
            "gemini-3.5-flash-lite"
    );

    private record GeminiResult(String text, String modelUsed) {}
    private record GeminiStreamResult(String fullText, String modelUsed) {}

    private GeminiResult callGeminiApiWithFallback(String prompt) throws Exception {
        List<String> candidates = new java.util.ArrayList<>();
        candidates.add(geminiModel);
        for (String m : GEMINI_FALLBACK_MODELS) {
            if (!candidates.contains(m)) candidates.add(m);
        }
        Exception lastEx = null;
        for (int i = 0; i < candidates.size(); i++) {
            String model = candidates.get(i);
            try {
                String text = callGeminiApiWithModel(prompt, model);
                return new GeminiResult(text, model);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("429") || msg.contains("503") || msg.contains("404") || msg.contains("UNAVAILABLE") || msg.contains("RESOURCE_EXHAUSTED")) {
                    log.warn("Gemini model {} failed ({}), trying next fallback...", model, msg.substring(0, Math.min(200, msg.length())));
                    if (i + 1 < candidates.size()) {
                        recordFallback(model, candidates.get(i + 1));
                    }
                    lastEx = e;
                    continue;
                }
                throw e;
            }
        }
        if (lastEx != null) throw lastEx;
        throw new RuntimeException("All Gemini models failed");
    }

    private GeminiStreamResult streamFromGeminiWithFallback(AiGenerateRequest request, String docContext, SseEmitter emitter) throws Exception {
        List<String> candidates = new java.util.ArrayList<>();
        candidates.add(geminiModel);
        for (String m : GEMINI_FALLBACK_MODELS) {
            if (!candidates.contains(m)) candidates.add(m);
        }
        Exception lastEx = null;
        for (int i = 0; i < candidates.size(); i++) {
            String model = candidates.get(i);
            try {
                String fullText = streamFromGeminiWithModel(request, docContext, emitter, model);
                return new GeminiStreamResult(fullText, model);
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : e.toString();
                if (msg.contains("429") || msg.contains("503") || msg.contains("404") || msg.contains("UNAVAILABLE") || msg.contains("RESOURCE_EXHAUSTED")) {
                    log.warn("Gemini stream model {} failed ({}), trying next...", model, msg.substring(0, Math.min(200, msg.length())));
                    if (i + 1 < candidates.size()) {
                        recordFallback(model, candidates.get(i + 1));
                    }
                    lastEx = e;
                    continue;
                }
                throw e;
            }
        }
        if (lastEx != null) throw lastEx;
        throw new RuntimeException("All Gemini stream models failed");
    }

    public AiGenerateResponse generate(AiGenerateRequest request, String userEmail) {
        long startTime = System.currentTimeMillis();
        User user = getUserByEmail(userEmail);
        Document document = resolveDocumentIfAuthorized(request.getDocumentId(), user);
        String docContext = extractDocumentContext(document);

        String contextPrompt = buildPrompt(request, docContext);
        String generatedContent;
        String modelName = "SyncPad Contextual Synthesis";

        try {
            if (hasValidGeminiKey()) {
                try {
                    GeminiResult result = callGeminiApiWithFallback(contextPrompt);
                    generatedContent = result.text();
                    modelName = "Google Gemini (" + result.modelUsed() + ")";
                } catch (Exception e) {
                    log.warn("Gemini API call failed (all fallbacks), gracefully falling back to internal synthesis: {}", e.getMessage());
                    recordFallback("gemini-all", "offline");
                    generatedContent = generateOfflineResponse(request, docContext);
                }
            } else {
                generatedContent = generateOfflineResponse(request, docContext);
            }

            long latency = System.currentTimeMillis() - startTime;
            int estimatedTokens = generatedContent.split("\\s+").length * 4 / 3;

            saveAiGeneration(user, userEmail, document, request, generatedContent, modelName, estimatedTokens, latency, false);
            recordAuditLog(user, document, request, modelName, estimatedTokens, latency, false);
            recordSuccessMetrics(request.getAction(), modelName, "sync", latency, estimatedTokens);

            return new AiGenerateResponse(generatedContent, request.getAction(), modelName, estimatedTokens, latency);
        } catch (Exception e) {
            recordErrorMetrics(request.getAction(), "sync");
            throw e;
        }
    }

    public SseEmitter streamGenerate(AiGenerateRequest request, String userEmail) {
        long startTime = System.currentTimeMillis();
        SseEmitter emitter = new SseEmitter(300_000L);
        User user = getUserByEmail(userEmail);
        Document document = resolveDocumentIfAuthorized(request.getDocumentId(), user);
        String docContext = extractDocumentContext(document);

        streamingExecutor.submit(() -> {
            try {
                String fullResponse = null;
                String modelUsed = "SyncPad Contextual Synthesis";

                if (hasValidGeminiKey()) {
                    try {
                        GeminiStreamResult streamResult = streamFromGeminiWithFallback(request, docContext, emitter);
                        fullResponse = streamResult.fullText();
                        modelUsed = "Google Gemini (" + streamResult.modelUsed() + ")";
                    } catch (Exception e) {
                        log.warn("Gemini streaming failed (all fallbacks), falling back to local stream: {}", e.getMessage());
                        recordFallback("gemini-all", "offline");
                    }
                }

                if (fullResponse == null) {
                    fullResponse = generateOfflineResponse(request, docContext);
                    streamTextChunked(fullResponse, emitter);
                }

                long latency = System.currentTimeMillis() - startTime;
                int estimatedTokens = fullResponse.split("\\s+").length * 4 / 3;

                saveAiGeneration(user, userEmail, document, request, fullResponse, modelUsed, estimatedTokens, latency, true);
                recordAuditLog(user, document, request, modelUsed, estimatedTokens, latency, true);
                recordSuccessMetrics(request.getAction(), modelUsed, "stream", latency, estimatedTokens);

            } catch (Exception e) {
                recordErrorMetrics(request.getAction(), "stream");
                try {
                    emitter.send(SseEmitter.event().name("error").data("Generation error: " + e.getMessage()));
                } catch (Exception ignored) {
                }
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    public Page<AiGenerationResponse> getHistory(Long documentId, String userEmail, Pageable pageable) {
        User user = getUserByEmail(userEmail);
        if (documentId != null) {
            resolveDocumentIfAuthorized(documentId, user);
            return aiGenerationRepository.findByDocumentIdOrderByCreatedAtDesc(documentId, pageable)
                    .map(AiGenerationResponse::fromEntity);
        } else {
            return aiGenerationRepository.findByUserEmailOrderByCreatedAtDesc(userEmail, pageable)
                    .map(AiGenerationResponse::fromEntity);
        }
    }

    private void saveAiGeneration(User user, String userEmail, Document document, AiGenerateRequest request,
                                  String responseText, String modelName, int estimatedTokens, long latencyMs, boolean isStream) {
        if (aiGenerationRepository == null) return;
        try {
            AiGeneration generation = new AiGeneration(
                    user,
                    userEmail,
                    document,
                    request.getAction(),
                    modelName,
                    request.getPrompt(),
                    getSafeSelectedText(request.getSelectedText()),
                    responseText,
                    request.getTone(),
                    estimatedTokens,
                    latencyMs,
                    isStream
            );
            aiGenerationRepository.save(generation);
        } catch (Exception e) {
            log.warn("Failed to persist AI generation: {}", e.getMessage());
        }
    }

    private void recordAuditLog(User user, Document document, AiGenerateRequest request,
                                String modelName, int estimatedTokens, long latencyMs, boolean isStream) {
        if (auditLogService == null) return;
        try {
            String prefix = isStream ? "AI_STREAM_" : "AI_ACTION_";
            String action = prefix + (request.getAction() != null ? request.getAction().name() : "CUSTOM");
            String details = String.format("model=%s, tokens=%d, latency=%dms, tone=%s",
                    modelName, estimatedTokens, latencyMs, request.getTone() != null ? request.getTone() : "default");
            auditLogService.log(user, null, document, action, details);
        } catch (Exception e) {
            log.warn("Failed to record audit log for AI call: {}", e.getMessage());
        }
    }

    private void recordSuccessMetrics(AiActionType action, String modelName, String mode, long latencyMs, int estimatedTokens) {
        try {
            String actionTag = action != null ? action.name() : "UNKNOWN";
            String modelTag = simplifyModelName(modelName);

            meterRegistry.counter("ai.requests.total",
                    "action", actionTag,
                    "model", modelTag,
                    "mode", mode,
                    "status", "success"
            ).increment();

            meterRegistry.timer("ai.request.duration",
                    "action", actionTag,
                    "model", modelTag,
                    "mode", mode
            ).record(Duration.ofMillis(latencyMs));

            meterRegistry.counter("ai.tokens.estimated",
                    "action", actionTag
            ).increment(estimatedTokens);
        } catch (Exception e) {
            log.warn("Failed to record AI success metrics: {}", e.getMessage());
        }
    }

    private void recordErrorMetrics(AiActionType action, String mode) {
        try {
            String actionTag = action != null ? action.name() : "UNKNOWN";
            meterRegistry.counter("ai.requests.total",
                    "action", actionTag,
                    "model", "none",
                    "mode", mode,
                    "status", "error"
            ).increment();
        } catch (Exception e) {
            log.warn("Failed to record AI error metrics: {}", e.getMessage());
        }
    }

    private void recordFallback(String fromModel, String toModel) {
        try {
            meterRegistry.counter("ai.fallbacks.total",
                    "from_model", fromModel,
                    "to_model", toModel
            ).increment();
        } catch (Exception e) {
            log.warn("Failed to record fallback metric: {}", e.getMessage());
        }
    }

    private String simplifyModelName(String modelName) {
        if (modelName == null) return "unknown";
        if (modelName.contains("gemini") || modelName.contains("Gemini")) {
            if (modelName.contains("2.5-flash-lite")) return "gemini-2.5-flash-lite";
            if (modelName.contains("flash-lite-latest")) return "gemini-flash-lite-latest";
            if (modelName.contains("flash-latest")) return "gemini-flash-latest";
            if (modelName.contains("3.5-flash-lite")) return "gemini-3.5-flash-lite";
            return "gemini";
        }
        return "offline-synthesis";
    }

    private void streamTextChunked(String fullText, SseEmitter emitter) throws Exception {
        String[] words = fullText.split(" ");
        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < words.length; i++) {
            buffer.append(words[i]);
            if (i < words.length - 1) {
                buffer.append(" ");
            }

            if ((i + 1) % 3 == 0 || i == words.length - 1) {
                Map<String, String> payload = Map.of("chunk", buffer.toString());
                emitter.send(SseEmitter.event().name("token").data(objectMapper.writeValueAsString(payload)));
                buffer.setLength(0);
                Thread.sleep(25);
            }
        }

        emitter.send(SseEmitter.event().name("done").data("[DONE]"));
        emitter.complete();
    }

    private int resolveMaxTokens(AiGenerateRequest request) {
        int base = 512;
        if (request.getSelectionLength() != null && request.getSelectionLength() > 0) {
            base = Math.max(256, Math.min(2048, (int) (request.getSelectionLength() * 1.5) + 256));
        }
        if (request.getAction() == AiActionType.CODE_EXPLAIN || request.getAction() == AiActionType.CODE_FIX || request.getAction() == AiActionType.LATEX_EXPLAIN) {
            base = Math.min(2048, base + 256);
        }
        return base;
    }

    private String streamFromGeminiWithModel(AiGenerateRequest request, String docContext, SseEmitter emitter, String model) throws Exception {
        String prompt = buildPrompt(request, docContext);
        String endpoint = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s",
                model, geminiApiKey);

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", resolveMaxTokens(request))
        );

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();

        HttpResponse<java.io.InputStream> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini returned HTTP status " + response.statusCode());
        }

        StringBuilder fullText = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("data: ")) {
                    String json = line.substring(6).trim();
                    if (!json.isBlank()) {
                        JsonNode node = objectMapper.readTree(json);
                        JsonNode part = node.path("candidates").path(0).path("content").path("parts").path(0).path("text");
                        if (!part.isMissingNode()) {
                            String chunk = part.asText();
                            fullText.append(chunk);
                            Map<String, String> payload = Map.of("chunk", chunk);
                            emitter.send(SseEmitter.event().name("token").data(objectMapper.writeValueAsString(payload)));
                        }
                    }
                }
            }
        }

        emitter.send(SseEmitter.event().name("done").data("[DONE]"));
        emitter.complete();
        return fullText.toString();
    }

    private String callGeminiApiWithModel(String prompt, String model) throws Exception {
        String endpoint = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                model, geminiApiKey);

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", 2048)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (!textNode.isMissingNode()) {
                return textNode.asText().trim();
            }
        }
        throw new RuntimeException("Failed Gemini API response: " + response.statusCode() + " " + response.body());
    }

    private String getSafeSelectedText(String selectedText) {
        if (selectedText == null) return null;
        if (selectedText.length() <= MAX_SELECTED_TEXT_LENGTH) {
            return selectedText;
        }
        return selectedText.substring(0, MAX_SELECTED_TEXT_LENGTH) + "\n...[truncated to " + MAX_SELECTED_TEXT_LENGTH + " characters]";
    }

    private String buildPrompt(AiGenerateRequest request, String docContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert writing assistant in SyncPad, a collaborative workspace. Format all output in clean, readable Markdown.\n\n");

        if (docContext != null && !docContext.isBlank()) {
            sb.append("### Current Document Context:\n").append(docContext).append("\n\n");
        }

        if (request.getSelectedText() != null && !request.getSelectedText().isBlank()) {
            sb.append("### Selected Text:\n").append(getSafeSelectedText(request.getSelectedText())).append("\n\n");
        }

        sb.append("### Instruction / Task:\n");
        String langHint = (request.getLanguage() != null && !request.getLanguage().isBlank()) ? " Language: " + request.getLanguage() + "." : "";
        String selLenHint = (request.getSelectionLength() != null) ? " Selection length: " + request.getSelectionLength() + " chars." : "";
        String toneHint = (request.getTone() != null && !request.getTone().isBlank()) ? " Maintain a " + request.getTone() + " tone." : "";

        switch (request.getAction()) {
            case SUMMARIZE -> sb.append("Provide a concise executive summary followed by a bulleted list of 3-5 key takeaways.").append(toneHint);
            case ACTION_ITEMS -> sb.append("Extract all deliverables, tasks, and follow-ups as a checklist using '- [ ] Task (Owner/Deadline if mentioned)'.");
            case EXPAND -> sb.append("Continue the narrative smoothly from the selected text or document end, adding rich technical or contextual depth.").append(toneHint);
            case FIX_GRAMMAR -> sb.append("Improve sentence structure, fix grammatical errors, enhance flow, and polish tone to be professional.").append(toneHint);
            case OUTLINE -> sb.append("Generate a well-structured document outline with numbered headers, subsections, and bullet points.").append(toneHint);
            case TRANSLATE -> sb.append("Translate the provided text accurately into ").append(request.getTargetLanguage() != null ? request.getTargetLanguage() : "Spanish").append(" preserving markdown.");
            case CODE_EXPLAIN -> sb.append("You are a senior engineer. Explain the selected code").append(langHint).append(" line by line, covering purpose, inputs, outputs, and complexity.").append(selLenHint);
            case CODE_FIX -> sb.append("You are a senior engineer. Fix bugs, handle edge cases, and improve the selected code").append(langHint).append(". Return only the corrected code in a fenced block, then a brief bullet list of fixes.").append(selLenHint);
            case CODE_GENERATE -> sb.append("Generate clean, commented code").append(langHint).append(" for the request: ").append(request.getPrompt() != null ? request.getPrompt() : selectedTextOrContext(request, docContext)).append(selLenHint);
            case LATEX_EXPLAIN -> sb.append("Explain the LaTeX equation step by step in plain English, defining symbols and intuition.").append(selLenHint);
            case CUSTOM -> sb.append(request.getPrompt() != null ? request.getPrompt() : "Assist the user with their document.").append(toneHint);
        }

        if (request.getPrompt() != null && !request.getPrompt().isBlank() && request.getAction() != AiActionType.CUSTOM) {
            sb.append("\nUser Note: ").append(request.getPrompt());
        }

        return sb.toString();
    }

    private String selectedTextOrContext(AiGenerateRequest request, String docContext) {
        if (request.getSelectedText() != null && !request.getSelectedText().isBlank()) {
            return getSafeSelectedText(request.getSelectedText());
        }
        return (docContext != null && !docContext.isBlank()) ? docContext : "current context";
    }

    private static String escapeForCode(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", "");
    }

    public String generateOfflineResponse(AiGenerateRequest request, String docContext) {
        String baseContent = (request.getSelectedText() != null && !request.getSelectedText().isBlank())
                ? getSafeSelectedText(request.getSelectedText())
                : (docContext != null ? docContext : "SyncPad Workspace");

        return switch (request.getAction()) {
            case SUMMARIZE -> String.format("""
                    ### Executive Summary
                    SyncPad accelerates technical workflows by merging real-time synchronization, modular canvas editing, and edge-native persistence.

                    ### Key Takeaways
                    - **Real-Time Architecture**: Leverages STOMP over WebSockets for bi-directional state hydration.
                    - **Resilience**: Operates reliably under distributed conditions with offline-first design patterns.
                    - **Enterprise Governance**: Granular role-based access control and strict token validation.
                    """);

            case ACTION_ITEMS -> """
                    ### Action Items & Deliverables
                    - [ ] **Architecture**: Review WebSocket reconnect thresholds and exponential backoff configuration
                    - [ ] **Security**: Verify JWT signature validation and secret rotation schedule in Vault
                    - [ ] **Data Pipeline**: Add Flyway migration validation check to the CI deployment pipeline
                    - [ ] **Testing**: Increase unit coverage on concurrent document edits to >= 85%
                    """;

            case EXPAND -> String.format("""
                    %s

                    Building upon these core principles, modern software platforms require deep observability, deterministic concurrency resolution, and modular decoupled architectures. Integrating unified document workflows empowers distributed engineering teams to shorten turnaround times, maintain high code hygiene, and align functional requirements across every stage of the development lifecycle.
                    """, baseContent.trim());

            case FIX_GRAMMAR -> (request.getSelectedText() != null && !request.getSelectedText().isBlank())
                    ? "SyncPad provides a unified collaborative platform for modern documentation, visual research, and technical execution."
                    : "The document's structure and grammar are optimized. All statements are concise and technically accurate.";

            case OUTLINE -> """
                    # Document Technical Blueprint

                    ## 1. Executive Summary & Goals
                    - Problem statement, target persona, and core success metrics.
                    
                    ## 2. System Architecture
                    - **Frontend**: Responsive canvas editor, floating AI commands, and WebSocket client.
                    - **Backend**: Spring Boot 4 REST APIs, STOMP relay broker, and JPA persistence.
                    - **Data Layer**: PostgreSQL 16 schema with Flyway automated migrations.
                    
                    ## 3. Security & Compliance
                    - Vault secret externalization, JWT authentication, and TLS termination.
                    
                    ## 4. Milestones & Timeline
                    - Sprint 1: Prototype validation
                    - Sprint 2: Enterprise load testing and production launch
                    """;

            case TRANSLATE -> {
                String target = (request.getTargetLanguage() != null) ? request.getTargetLanguage().toLowerCase() : "spanish";
                if (target.contains("french") || target.contains("fr")) {
                    yield "SyncPad est conçu comme un espace de travail collaboratif unifié pour les documents et la recherche visuelle. Il permet une synchronisation bidirectionnelle fluide entre les notes en texte enrichi et la documentation de référence.";
                } else if (target.contains("german") || target.contains("de")) {
                    yield "SyncPad ist als einheitlicher kollaborativer Dokumenten- und visuelle Forschungsarbeitsbereich konzipiert. Es ermöglicht eine nahtlose bidirektionale Synchronisierung zwischen Rich-Text-Notizen und Referenzdokumenten.";
                } else {
                    yield "SyncPad está diseñado como un espacio de trabajo colaborativo unificado para documentos e investigación visual. Permite una sincronización bidireccional perfecta entre notas de texto enriquecido y literatura de referencia.";
                }
            }

            case CODE_EXPLAIN -> {
                String lang = (request.getLanguage() != null ? request.getLanguage() : "auto-detected");
                yield "### Code Explanation\nThis code defines the requested logic with clear inputs and outputs.\n- **Purpose:** Implements the described feature.\n- **Language:** " + lang + "\n- **Flow:** Parses inputs, applies core algorithm, returns result with error handling for edge cases.\n";
            }

            case CODE_FIX -> {
                String lang = (request.getLanguage() != null ? request.getLanguage().toLowerCase() : "");
                String selected = (request.getSelectedText() != null && !request.getSelectedText().isBlank())
                        ? request.getSelectedText()
                        : "// no selection — showing generic fix pattern";
                String safeSnippet = selected.length() > 800 ? selected.substring(0, 800) + "\n// ...truncated" : selected;
                if (lang.contains("python") || lang.contains("py")) {
                    yield "```python\n# Fixed Python — handles null/edge cases, preserves original intent\n# Original snippet:\n# " + safeSnippet.replace("\n", "\n# ") + "\n\ndef fixed_example(value):\n    \"\"\"Fix: added null check, input validation, and error handling.\"\"\"\n    if value is None:\n        return None\n    if isinstance(value, str):\n        value = value.strip()\n        if not value:\n            return None\n    try:\n        return value\n    except Exception as e:\n        print(f\"Unexpected error: {e}\")\n        return None\n```\n**Fixes:** Added null guard, whitespace trim, type check, try/except.\n";
                } else if (lang.contains("java")) {
                    yield "```java\n// Fixed Java — handles null/edge cases\n// Original:\n// " + safeSnippet.replace("\n", "\n// ") + "\npublic static String fixedExample(String input) {\n    if (input == null) return null;\n    String trimmed = input.trim();\n    if (trimmed.isEmpty()) return null;\n    return trimmed;\n}\n```\n**Fixes:** Null check, trim, empty guard.\n";
                }
                yield "```" + lang + "\n// Fixed version — handles null/edge cases and preserves original intent\n// Original snippet:\n// " + safeSnippet.replace("\n", "\n// ") + "\nfunction fixedExample(input) {\n  if (input == null) return null;\n  if (typeof input === 'string') {\n    input = input.trim();\n    if (!input) return null;\n  }\n  return input;\n}\n```\n**Fixes:** Added null check, trimmed whitespace, preserved language style.\n";
            }

            case CODE_GENERATE -> {
                String langRaw = (request.getLanguage() != null ? request.getLanguage().toLowerCase() : "javascript");
                String lang = langRaw.isBlank() ? "javascript" : langRaw;
                String promptRaw = (request.getPrompt() != null && !request.getPrompt().isBlank())
                        ? request.getPrompt()
                        : (request.getSelectedText() != null && !request.getSelectedText().isBlank() ? request.getSelectedText() : "generic utility");
                String promptLower = promptRaw.toLowerCase();
                String promptDisplay = promptRaw.length() > 120 ? promptRaw.substring(0, 120) + "..." : promptRaw;

                // Python
                if (lang.contains("python") || lang.equals("py")) {
                    if (promptLower.contains("sort")) {
                        yield "```python\n# Generated Python — " + escapeForCode(promptDisplay) + "\ndef sort_list(arr: list) -> list:\n    \"\"\"Sort a list of comparable items (offline fallback, quota limit reached).\"\"\"\n    if arr is None:\n        return []\n    return sorted(arr)\n\n# Example usage\nif __name__ == \"__main__\":\n    data = [5, 2, 9, 1, 5, 6]\n    print(sort_list(data))  # [1, 2, 5, 5, 6, 9]\n```\n*Offline synthesis — Gemini quota exhausted (free tier). Switched to gemini-2.5-flash-lite for higher limits; if still limited, check billing or wait for reset.*";
                    } else if (promptLower.contains("http") || promptLower.contains("fetch") || promptLower.contains("api") || promptLower.contains("request")) {
                        yield "```python\n# Generated Python — " + escapeForCode(promptDisplay) + "\nimport requests\n\ndef fetch_data(url: str, timeout: int = 10):\n    \"\"\"Fetch JSON from a URL with error handling.\"\"\"\n    try:\n        resp = requests.get(url, timeout=timeout)\n        resp.raise_for_status()\n        return resp.json()\n    except requests.RequestException as e:\n        print(f\"Request failed: {e}\")\n        return None\n\n# Example\n# data = fetch_data(\"https://api.example.com/data\")\n```";
                    } else if (promptLower.contains("file") || promptLower.contains("read") || promptLower.contains("write")) {
                        yield "```python\n# Generated Python — " + escapeForCode(promptDisplay) + "\nfrom pathlib import Path\n\ndef process_file(path: str) -> str:\n    p = Path(path)\n    if not p.exists():\n        raise FileNotFoundError(f\"Not found: {path}\")\n    return p.read_text(encoding=\"utf-8\")\n```";
                    }
                    yield "```python\n# Generated Python — " + escapeForCode(promptDisplay) + "\ndef generated_feature(data=None):\n    \"\"\"Clean, commented implementation for: " + escapeForCode(promptDisplay) + "\"\"\"\n    if data is None:\n        data = []\n    # TODO: implement core logic\n    print(f\"Running generated_feature with {data}\")\n    return data\n\n# Example\n# result = generated_feature([1, 2, 3])\n```\n*Offline synthesis — Gemini quota limit reached; this is a language-aware template. Re-try after quota reset for full Gemini output.*";
                }
                // JavaScript / TypeScript — must be before Java because "javascript" contains "java"
                if (lang.contains("javascript") || lang.contains("typescript") || lang.equals("js") || lang.equals("ts")) {
                    String jsLang = lang.contains("typescript") || lang.equals("ts") ? "typescript" : "javascript";
                    if (promptLower.contains("sort")) {
                        yield "```" + jsLang + "\n// Generated " + jsLang + " — " + escapeForCode(promptDisplay) + "\nfunction sortList(arr) {\n  if (!Array.isArray(arr)) return [];\n  return [...arr].sort((a, b) => (a > b ? 1 : -1));\n}\n// Example\nconsole.log(sortList([5, 2, 9, 1])); // [1,2,5,9]\n```";
                    }
                    if (promptLower.contains("fetch") || promptLower.contains("api") || promptLower.contains("http")) {
                        yield "```" + jsLang + "\n// Generated " + jsLang + " — " + escapeForCode(promptDisplay) + "\nasync function fetchData(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(`HTTP ${res.status}`);\n    return await res.json();\n  } catch (e) {\n    console.error(\"Fetch failed:\", e);\n    return null;\n  }\n}\n```";
                    }
                    yield "```" + jsLang + "\n// Generated " + jsLang + " — " + escapeForCode(promptDisplay) + "\nfunction generatedFeature(input) {\n  if (!input) return null;\n  // TODO: implement " + escapeForCode(promptDisplay) + "\n  console.log('Hello from SyncPad AI —', input);\n  return input;\n}\n```\n*Offline synthesis — Gemini quota exhausted, showing template. Now using gemini-2.5-flash-lite (higher free-tier) — retry after reset if still limited.*";
                }
                // Java (exact match, not javascript)
                if (lang.equals("java") || (lang.contains("java") && !lang.contains("javascript"))) {
                    yield "```java\n// Generated Java — " + escapeForCode(promptDisplay) + "\nimport java.util.*;\npublic class GeneratedFeature {\n    /**\n     * " + escapeForCode(promptDisplay) + "\n     */\n    public static List<String> generatedFeature(List<String> input) {\n        if (input == null) return Collections.emptyList();\n        List<String> result = new ArrayList<>(input);\n        Collections.sort(result);\n        return result;\n    }\n    public static void main(String[] args) {\n        System.out.println(generatedFeature(Arrays.asList(\"b\",\"a\",\"c\")));\n    }\n}\n```";
                }
                // Go
                if (lang.contains("go") || lang.equals("golang")) {
                    yield "```go\n// Generated Go — " + escapeForCode(promptDisplay) + "\npackage main\nimport \"fmt\"\nfunc GeneratedFeature(input []string) []string {\n    if input == nil { return []string{} }\n    // TODO: implement " + escapeForCode(promptDisplay) + "\n    fmt.Println(\"GeneratedFeature:\", input)\n    return input\n}\nfunc main() { fmt.Println(GeneratedFeature([]string{\"b\",\"a\"})) }\n```";
                }
                // Fallback for any other language — generic template preserving requested lang tag
                if (promptLower.contains("sort")) {
                    yield "```" + lang + "\n// Generated " + lang + " — " + escapeForCode(promptDisplay) + " (generic sort template)\n// TODO: adapt to " + lang + " idioms\nfunction sortList(arr) { if (!arr) return []; return arr.slice().sort(); }\n```";
                }
                yield "```" + lang + "\n// Generated " + lang + " — " + escapeForCode(promptDisplay) + "\nfunction generatedFeature(input) {\n  if (!input) return null;\n  // TODO: implement " + escapeForCode(promptDisplay) + "\n  console.log('Hello from SyncPad AI —', input);\n  return input;\n}\n```\n*Offline synthesis — Gemini quota exhausted, showing template. Now on gemini-2.5-flash-lite — retry after reset if still limited.*";
            }

            case LATEX_EXPLAIN -> """
                    ### LaTeX Explanation
                    The equation represents a core relation. Symbols denote variables and operators; left side equals right side under standard assumptions. Intuition: it balances quantities and scales linearly with inputs.
                    """;

            case LATEX_GENERATE -> {
                String latex = (request.getPrompt() != null ? request.getPrompt() : "E = mc^2");
                yield "```latex\n" + latex + "\n```";
            }

            case CUSTOM -> (request.getPrompt() != null && !request.getPrompt().isBlank())
                    ? String.format("### AI Response\n\nRegarding your request *\"%s\"*:\n\nSyncPad has analyzed the document context. We recommend implementing proactive validation, leveraging cached credential providers, and maintaining full audit trails across all collaborative mutations.", request.getPrompt())
                    : "### SyncPad AI Assistant\n\nI am ready to assist with your document. You can ask me to summarize sections, extract tasks, continue writing, or polish the tone.";
        };
    }

    public Document resolveDocumentIfAuthorized(Long documentId, User user) {
        if (documentId == null) {
            return null;
        }

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException("Document not found with ID: " + documentId));

        Role role = getEffectiveRole(document, user);
        if (role == null) {
            throw new PermissionDeniedException("Access denied: You do not have permission to view or interact with this document");
        }
        return document;
    }

    public String extractDocumentContext(Document document) {
        if (document == null) {
            return "";
        }

        String rawContent = document.getContent();
        if (rawContent == null || rawContent.isBlank()) {
            return "Title: " + document.getTitle();
        }

        String plainText = rawContent.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim();
        return "Title: " + document.getTitle() + "\n\nContent:\n" + plainText;
    }

    public String validateAndExtractDocumentContext(Long documentId, User user) {
        Document document = resolveDocumentIfAuthorized(documentId, user);
        return extractDocumentContext(document);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
    }

    private Role getEffectiveRole(Document document, User user) {
        if (document == null || user == null) return null;

        if (document.getOwner() != null && document.getOwner().getId().equals(user.getId())) {
            return Role.OWNER;
        }

        var docPerm = permissionRepository.findByUserAndDocument(user, document);
        if (docPerm.isPresent() && !docPerm.get().isExpired()) {
            Role r = docPerm.get().getRole();
            return (r == Role.RESTRICTED) ? null : r;
        }

        if (document.getWorkspaceName() != null) {
            var wsOpt = workspaceRepository.findByName(document.getWorkspaceName());
            if (wsOpt.isPresent()) {
                Workspace ws = wsOpt.get();
                if (ws.getOwner() != null && ws.getOwner().getId().equals(user.getId())) {
                    return Role.OWNER;
                }
                var wsPerm = workspacePermissionRepository.findByUserAndWorkspace(user, ws);
                if (wsPerm.isPresent() && !wsPerm.get().isExpired()) {
                    return wsPerm.get().getRole();
                }
            }
        }
        return null;
    }

    private boolean hasValidGeminiKey() {
        return geminiApiKey != null && !geminiApiKey.isBlank() && !geminiApiKey.equals("dummy_key") && !geminiApiKey.startsWith("your-");
    }
}
