package com.example.syncpad.config;

import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import com.example.syncpad.security.CustomUserDetailsService;
import com.example.syncpad.security.JwtService;
import com.example.syncpad.security.TokenBlacklistService;
import com.example.syncpad.service.DocumentService;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final DocumentService documentService;
    private final TokenBlacklistService tokenBlacklistService;

    public WebSocketConfig(
            JwtService jwtService,
            CustomUserDetailsService userDetailsService,
            DocumentService documentService,
            TokenBlacklistService tokenBlacklistService
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.documentService = documentService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173,http://localhost:8082,http://localhost:8443,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8082,http://127.0.0.1:8443}")
    private String allowedOrigins;

    @Value("${spring.websocket.relay.enabled:false}")
    private boolean relayEnabled;

    @Value("${spring.websocket.relay.host:localhost}")
    private String relayHost;

    @Value("${spring.websocket.relay.port:61613}")
    private int relayPort;

    @Value("${spring.websocket.relay.client-login:guest}")
    private String relayClientLogin;

    @Value("${spring.websocket.relay.client-passcode:guest}")
    private String relayClientPasscode;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        if (relayEnabled) {
            config.enableStompBrokerRelay("/topic")
                    .setRelayHost(relayHost)
                    .setRelayPort(relayPort)
                    .setClientLogin(relayClientLogin)
                    .setClientPasscode(relayClientPasscode)
                    .setSystemLogin(relayClientLogin)
                    .setSystemPasscode(relayClientPasscode)
                    .setVirtualHost("/");
        } else {
            config.enableSimpleBroker("/topic");
        }
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry.setMessageSizeLimit(20 * 1024 * 1024); // 20MB for rich captures and snapshots
        registry.setSendBufferSizeLimit(20 * 1024 * 1024); // 20MB
        registry.setSendTimeLimit(20 * 1000); // 20 seconds
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null || accessor.getCommand() == null) {
                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                        throw new AccessDeniedException("Unauthorized WebSocket connection");
                    }

                    try {
                        String jwt = authHeader.substring(7);
                        if (tokenBlacklistService.isBlacklisted(jwt)) {
                            throw new AccessDeniedException("Revoked WebSocket token");
                        }
                        String userEmail = jwtService.extractUsername(jwt);
                        UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                        if (!jwtService.isTokenValid(jwt, userDetails)) {
                            throw new AccessDeniedException("Unauthorized WebSocket connection");
                        }
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        userDetails, null, userDetails.getAuthorities());
                        accessor.setUser(authentication);
                    } catch (AccessDeniedException e) {
                        throw e;
                    } catch (Exception e) {
                        throw new AccessDeniedException("Unauthorized WebSocket connection", e);
                    }
                } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    java.security.Principal user = accessor.getUser();
                    if (user == null || user.getName() == null) {
                        throw new AccessDeniedException("Unauthenticated WebSocket subscription");
                    }
                    String destination = accessor.getDestination();
                    if (destination != null && destination.startsWith("/topic/notifications/")) {
                        String targetUser = destination.substring("/topic/notifications/".length());
                        if (!targetUser.equalsIgnoreCase(user.getName())) {
                            throw new AccessDeniedException("Cannot subscribe to notifications for another user");
                        }
                    } else if (destination != null && (destination.startsWith("/topic/documents/") || destination.startsWith("/topic/documents."))) {
                        String suffix = destination.startsWith("/topic/documents/")
                                ? destination.substring("/topic/documents/".length())
                                : destination.substring("/topic/documents.".length());
                        String documentId = suffix.split("[/.]", 2)[0];
                        try {
                            documentService.getDocument(Long.valueOf(documentId), user.getName());
                        } catch (Exception e) {
                            throw new AccessDeniedException("Cannot subscribe to this document", e);
                        }
                    }
                } else if (StompCommand.SEND.equals(accessor.getCommand())) {
                    java.security.Principal user = accessor.getUser();
                    if (user == null || user.getName() == null) {
                        throw new AccessDeniedException("Unauthenticated WebSocket message");
                    }
                    String destination = accessor.getDestination();
                    if (destination == null || !destination.startsWith("/app/documents/")) {
                        throw new AccessDeniedException("Invalid or disallowed WebSocket SEND destination: " + destination);
                    }
                    String path = destination.substring("/app/documents/".length());
                    String[] parts = path.split("/");
                    if (parts.length < 2) {
                        throw new AccessDeniedException("Malformed document destination path: " + destination);
                    }
                    String documentIdStr = parts[0];
                    String action = parts[1];
                    if (!action.equals("edit") && !action.equals("save") && !action.equals("pdf-annotation")) {
                        throw new AccessDeniedException("Unsupported document SEND action: " + action);
                    }
                    try {
                        Long documentId = Long.valueOf(documentIdStr);
                        documentService.assertCanEditDocument(documentId, user.getName());
                    } catch (AccessDeniedException ade) {
                        throw ade;
                    } catch (Exception e) {
                        throw new AccessDeniedException("Unauthorized SEND to document: " + documentIdStr, e);
                    }
                }
                return message;
            }
        });
    }
}
