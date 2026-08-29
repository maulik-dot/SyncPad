package com.example.syncpad.controller;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.syncpad.dto.request.AiGenerateRequest;
import com.example.syncpad.dto.response.AiActionOption;
import com.example.syncpad.dto.response.AiGenerateResponse;
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
            Authentication authentication
    ) {
        return aiAssistantService.streamGenerate(request, authentication.getName());
    }
}
