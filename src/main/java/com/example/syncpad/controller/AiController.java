package com.example.syncpad.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.syncpad.dto.request.AiGenerateRequest;
import com.example.syncpad.dto.response.AiActionOption;
import com.example.syncpad.dto.response.AiGenerateResponse;
import com.example.syncpad.dto.response.AiGenerationResponse;
import com.example.syncpad.service.AiAssistantService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiAssistantService aiAssistantService;

    public AiController(AiAssistantService aiAssistantService) {
        this.aiAssistantService = aiAssistantService;
    }

    @GetMapping("/actions")
    public ResponseEntity<List<AiActionOption>> getActions() {
        return ResponseEntity.ok(aiAssistantService.getAvailableActions());
    }

    @PostMapping("/generate")
    public ResponseEntity<AiGenerateResponse> generate(
            @Valid @RequestBody AiGenerateRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(aiAssistantService.generate(request, authentication.getName()));
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
            @Valid @RequestBody AiGenerateRequest request,
            Authentication authentication,
            jakarta.servlet.http.HttpServletResponse response
    ) {
        // Disable nginx buffering for SSE
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache");
        return aiAssistantService.streamGenerate(request, authentication.getName());
    }

    @GetMapping("/history")
    public ResponseEntity<Page<AiGenerationResponse>> getHistory(
            @RequestParam(required = false) Long documentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        return ResponseEntity.ok(aiAssistantService.getHistory(documentId, authentication.getName(), pageable));
    }
}
