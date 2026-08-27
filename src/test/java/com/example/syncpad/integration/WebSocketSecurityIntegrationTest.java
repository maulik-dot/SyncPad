package com.example.syncpad.integration;

import java.security.Principal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.example.syncpad.config.WebSocketConfig;
import com.example.syncpad.controller.DocumentWebSocketController;
import com.example.syncpad.dto.message.DocumentEditMessage;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.repository.DocumentPermissionRepository;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.security.JwtService;
import com.example.syncpad.security.TokenBlacklistService;
import com.example.syncpad.service.DocumentService;

@SpringBootTest
public class WebSocketSecurityIntegrationTest {

    @Autowired private WebSocketConfig webSocketConfig;
    @Autowired private DocumentWebSocketController webSocketController;
    @Autowired private DocumentService documentService;
    @Autowired private UserRepository userRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentPermissionRepository permissionRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private TokenBlacklistService tokenBlacklistService;

    private User alice;
    private User bob;
    private Document doc;
    private String aliceToken;
    private ChannelInterceptor interceptor;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        alice = userRepository.save(new User("Alice", "ws_alice_" + ts + "@test.com", passwordEncoder.encode("pass123")));
        bob = userRepository.save(new User("Bob", "ws_bob_" + ts + "@test.com", passwordEncoder.encode("pass123")));
        doc = documentRepository.save(new Document("WebSocket Spec", "Initial Content", alice));

        aliceToken = jwtService.generateToken(alice.getEmail());

        org.springframework.messaging.simp.config.ChannelRegistration registration =
                new org.springframework.messaging.simp.config.ChannelRegistration();
        webSocketConfig.configureClientInboundChannel(registration);

        @SuppressWarnings("unchecked")
        List<ChannelInterceptor> interceptors = 
                (List<ChannelInterceptor>) ReflectionTestUtils.getField(registration, "interceptors");
        if (interceptors != null && !interceptors.isEmpty()) {
            this.interceptor = interceptors.get(0);
        }
    }

    @Test
    void testConnectWithValidJwtAuthenticatesUser() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.addNativeHeader("Authorization", "Bearer " + aliceToken);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, (MessageChannel) null);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);

        assertNotNull(resultAccessor.getUser());
        assertEquals(alice.getEmail(), resultAccessor.getUser().getName());
    }

    @Test
    void testConnectWithBlacklistedTokenThrowsAccessDenied() {
        tokenBlacklistService.blacklistToken(aliceToken, System.currentTimeMillis() + 60000);
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.addNativeHeader("Authorization", "Bearer " + aliceToken);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testConnectWithInvalidJwtFailsToAuthenticate() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.addNativeHeader("Authorization", "Bearer invalid.jwt.token");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testSubscribeWithoutAuthenticationThrowsAccessDenied() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/documents/" + doc.getId());
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testSubscribeToOtherUserNotificationsThrowsAccessDenied() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setUser(new UsernamePasswordAuthenticationToken(alice.getEmail(), null));
        accessor.setDestination("/topic/notifications/" + bob.getEmail());
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testSubscribeToOwnNotificationsSucceeds() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setUser(new UsernamePasswordAuthenticationToken(alice.getEmail(), null));
        accessor.setDestination("/topic/notifications/" + alice.getEmail());
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertDoesNotThrow(() -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testViewerCannotBroadcastEdits() {
        documentService.updateDocumentPermission(doc.getId(), bob.getId(), bob.getEmail(), Role.VIEWER, alice.getEmail());

        Principal bobPrincipal = () -> bob.getEmail();
        DocumentEditMessage editMsg = new DocumentEditMessage(doc.getId(), "Title", "Malicious Content", bob.getEmail(), "Bob", "EDIT");

        assertThrows(com.example.syncpad.exception.PermissionDeniedException.class, () -> {
            webSocketController.handleDocumentEdit(doc.getId(), editMsg, bobPrincipal, null);
        });
    }

    @Test
    void testEditorCanBroadcastEdits() {
        documentService.updateDocumentPermission(doc.getId(), bob.getId(), bob.getEmail(), Role.EDITOR, alice.getEmail());

        Principal bobPrincipal = () -> bob.getEmail();
        DocumentEditMessage editMsg = new DocumentEditMessage(doc.getId(), "Title", "Legitimate Content", bob.getEmail(), "Bob", "EDIT");

        assertDoesNotThrow(() -> {
            webSocketController.handleDocumentEdit(doc.getId(), editMsg, bobPrincipal, null);
        });
    }

    @Test
    void testSendToDisallowedDestinationThrowsAccessDenied() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setUser(new UsernamePasswordAuthenticationToken(alice.getEmail(), null));
        accessor.setDestination("/app/disallowed/endpoint");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testSendEditByViewerThrowsAccessDeniedAtInterceptorLevel() {
        documentService.updateDocumentPermission(doc.getId(), bob.getId(), bob.getEmail(), Role.VIEWER, alice.getEmail());

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setUser(new UsernamePasswordAuthenticationToken(bob.getEmail(), null));
        accessor.setDestination("/app/documents/" + doc.getId() + "/edit");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }

    @Test
    void testSendEditByEditorSucceedsAtInterceptorLevel() {
        documentService.updateDocumentPermission(doc.getId(), bob.getId(), bob.getEmail(), Role.EDITOR, alice.getEmail());

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setUser(new UsernamePasswordAuthenticationToken(bob.getEmail(), null));
        accessor.setDestination("/app/documents/" + doc.getId() + "/edit");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertDoesNotThrow(() -> {
            interceptor.preSend(message, (MessageChannel) null);
        });
    }
}
