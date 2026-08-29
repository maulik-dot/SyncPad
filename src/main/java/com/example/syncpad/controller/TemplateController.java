package com.example.syncpad.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.request.CreateTemplateRequest;
import com.example.syncpad.dto.response.DocumentResponse;
import com.example.syncpad.dto.response.TemplateResponse;
import com.example.syncpad.service.TemplateService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/templates")
public class TemplateController {

    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public ResponseEntity<List<TemplateResponse>> getTemplates(
            @RequestParam(required = false) Long workspaceId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(templateService.getTemplates(workspaceId, authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<TemplateResponse> createTemplate(
            @Valid @RequestBody CreateTemplateRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(templateService.createTemplate(request, authentication.getName()));
    }

    @PostMapping("/{id}/instantiate")
    public ResponseEntity<DocumentResponse> instantiateTemplate(
            @PathVariable Long id,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) String title,
            Authentication authentication
    ) {
        return ResponseEntity.ok(templateService.instantiateTemplate(id, workspaceId, title, authentication.getName()));
    }
}
