package com.example.syncpad.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.dto.sso.SsoLoginRequest;
import com.example.syncpad.dto.sso.SsoProviderResponse;
import com.example.syncpad.service.SsoProvisioningService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth/sso")
public class SsoController {

    private final SsoProvisioningService ssoProvisioningService;

    public SsoController(SsoProvisioningService ssoProvisioningService) {
        this.ssoProvisioningService = ssoProvisioningService;
    }

    @GetMapping("/providers")
    public ResponseEntity<List<SsoProviderResponse>> getProviders() {
        return ResponseEntity.ok(ssoProvisioningService.getActiveProviders());
    }

    @PostMapping("/discover")
    public ResponseEntity<SsoProviderResponse> discoverDomain(@RequestBody Map<String, String> body) {
        String emailOrDomain = body.getOrDefault("domain", body.get("email"));
        return ResponseEntity.ok(ssoProvisioningService.discoverDomain(emailOrDomain));
    }

    @GetMapping("/discover")
    public ResponseEntity<SsoProviderResponse> discoverDomainGet(@RequestParam String domain) {
        return ResponseEntity.ok(ssoProvisioningService.discoverDomain(domain));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> ssoLogin(@Valid @RequestBody SsoLoginRequest request) {
        return ResponseEntity.ok(ssoProvisioningService.processSsoLogin(request));
    }
}
