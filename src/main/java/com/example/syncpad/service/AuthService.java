package com.example.syncpad.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.syncpad.dto.request.LoginRequest;
import com.example.syncpad.dto.request.RegisterRequest;
import com.example.syncpad.dto.response.AuthResponse;
import com.example.syncpad.entity.RefreshToken;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.exception.DuplicateEmailException;
import com.example.syncpad.exception.InvalidTokenException;
import com.example.syncpad.repository.RefreshTokenRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.example.syncpad.security.JwtService;
import com.example.syncpad.security.TokenBlacklistService;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspacePermissionRepository workspacePermissionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            WorkspacePermissionRepository workspacePermissionRepository,
            RefreshTokenRepository refreshTokenRepository,
            TokenBlacklistService tokenBlacklistService,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspacePermissionRepository = workspacePermissionRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenBlacklistService = tokenBlacklistService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    private void ensureDefaultWorkspace(User user) {
        if (workspaceRepository.findByOwnerId(user.getId()).isEmpty()) {
            String defaultWsName = (user.getName() != null && !user.getName().isBlank() ? user.getName() : "Personal") + "'s Workspace";
            String initial = (user.getName() != null && !user.getName().isBlank()) ? user.getName().substring(0, 1).toUpperCase() : "P";
            Workspace ws = new Workspace(defaultWsName, "Personal workspace for documents, whiteboards and notes", "#2563eb", initial, user);
            Workspace savedWs = workspaceRepository.save(ws);
            workspacePermissionRepository.save(new WorkspacePermission(savedWs, user, Role.OWNER));
        }
    }

    public RefreshToken createRefreshToken(User user) {
        RefreshToken rt = new RefreshToken(
                UUID.randomUUID().toString(),
                user,
                LocalDateTime.now().plusDays(7)
        );
        return refreshTokenRepository.save(rt);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateEmailException("User with email " + request.getEmail() + " already exists");
        }
        User user = new User(request.getName(), request.getEmail(), passwordEncoder.encode(request.getPassword()));
        User savedUser = userRepository.save(user);

        ensureDefaultWorkspace(savedUser);

        String token = jwtService.generateToken(savedUser.getEmail());
        RefreshToken refreshToken = createRefreshToken(savedUser);
        return new AuthResponse(token, refreshToken.getToken(), savedUser.getId(), savedUser.getName(), savedUser.getEmail());
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new InvalidTokenException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new InvalidTokenException("Invalid email or password");
        }

        ensureDefaultWorkspace(user);

        String token = jwtService.generateToken(user.getEmail());
        RefreshToken refreshToken = createRefreshToken(user);
        return new AuthResponse(token, refreshToken.getToken(), user.getId(), user.getName(), user.getEmail());
    }

    @Transactional
    public AuthResponse refreshToken(String requestRefreshToken) {
        RefreshToken rt = refreshTokenRepository.findByToken(requestRefreshToken)
                .orElseThrow(() -> new InvalidTokenException("Invalid refresh token"));

        if (rt.isRevoked() || rt.isExpired()) {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
            throw new InvalidTokenException("Refresh token has expired or been revoked");
        }

        // Token rotation
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);

        User user = rt.getUser();
        String newAccessToken = jwtService.generateToken(user.getEmail());
        RefreshToken newRefreshToken = createRefreshToken(user);
        return new AuthResponse(newAccessToken, newRefreshToken.getToken(), user.getId(), user.getName(), user.getEmail());
    }

    @Transactional
    public void logout(String requestRefreshToken, String authHeader) {
        if (requestRefreshToken != null && !requestRefreshToken.isBlank()) {
            refreshTokenRepository.findByToken(requestRefreshToken).ifPresent(rt -> {
                rt.setRevoked(true);
                refreshTokenRepository.save(rt);
            });
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tokenBlacklistService.blacklistToken(token, System.currentTimeMillis() + 86_400_000L);
        }
    }

    @org.springframework.beans.factory.annotation.Value("${google.client-id:YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com}")
    private String googleClientId;

    @Transactional
    public AuthResponse googleLogin(com.example.syncpad.dto.request.GoogleLoginRequest request) {
        String email = request.getEmail();
        String name = request.getName();
        String googleSub = request.getGoogleSub();

        if (request.getIdToken() != null && !request.getIdToken().isBlank()) {
            try {
                com.google.api.client.json.gson.GsonFactory jsonFactory = com.google.api.client.json.gson.GsonFactory.getDefaultInstance();
                com.google.api.client.http.javanet.NetHttpTransport transport = new com.google.api.client.http.javanet.NetHttpTransport();

                com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier verifier =
                        new com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier.Builder(transport, jsonFactory)
                                .setAudience(java.util.Collections.singletonList(googleClientId))
                                .build();

                com.google.api.client.googleapis.auth.oauth2.GoogleIdToken idToken = verifier.verify(request.getIdToken());
                if (idToken != null) {
                    com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload = idToken.getPayload();
                    email = payload.getEmail();
                    name = (String) payload.get("name");
                    googleSub = payload.getSubject();
                } else {
                    throw new InvalidTokenException("Invalid or expired Google ID Token");
                }
            } catch (InvalidTokenException ite) {
                throw ite;
            } catch (Exception e) {
                throw new InvalidTokenException("Google ID Token verification failed: " + e.getMessage());
            }
        } else {
            throw new InvalidTokenException("Google ID Token is required for Google authentication");
        }

        if (email == null || email.isBlank()) {
            throw new InvalidTokenException("Google authentication failed: Email is required");
        }

        final String finalEmail = email;
        final String finalName = (name != null && !name.isBlank()) ? name : email.split("@")[0];
        final String finalSub = googleSub;

        User user = userRepository.findByEmail(finalEmail).orElseGet(() -> {
            User newUser = new User(finalName, finalEmail, passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
            newUser.setProvider("GOOGLE");
            newUser.setProviderId(finalSub);
            return userRepository.save(newUser);
        });

        ensureDefaultWorkspace(user);

        String token = jwtService.generateToken(user.getEmail());
        RefreshToken refreshToken = createRefreshToken(user);
        return new AuthResponse(token, refreshToken.getToken(), user.getId(), user.getName(), user.getEmail());
    }
}
