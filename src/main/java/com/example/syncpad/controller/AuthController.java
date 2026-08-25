package com.example.syncpad.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.request.LoginRequest;
import com.example.syncpad.dto.request.RegisterRequest;
import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.service.AuthService;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@jakarta.validation.Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@jakarta.validation.Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @org.springframework.beans.factory.annotation.Value("${google.client-id:}")
    private String googleClientId;

    @org.springframework.web.bind.annotation.GetMapping("/config")
    public ResponseEntity<java.util.Map<String, String>> getConfig() {
        return ResponseEntity.ok(java.util.Map.of("googleClientId", googleClientId));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@jakarta.validation.Valid @RequestBody com.example.syncpad.dto.request.GoogleLoginRequest request) {
        return ResponseEntity.ok(authService.googleLogin(request));
    }
}

