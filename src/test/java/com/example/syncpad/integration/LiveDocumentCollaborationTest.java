package com.example.syncpad.integration;

import java.lang.reflect.Type;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import com.example.syncpad.crdt.CrdtId;
import com.example.syncpad.crdt.CrdtOperation;
import com.example.syncpad.dto.message.DocumentEditMessage;
import com.example.syncpad.entity.Document;
import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.repository.DocumentRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.security.JwtService;
import com.example.syncpad.service.DocumentService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class LiveDocumentCollaborationTest {

    @LocalServerPort
    private int port;

    @Autowired private UserRepository userRepository;
    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentService documentService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private User alice;
    private User bob;
    private Document doc;
    private String aliceToken;
    private String bobToken;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        alice = userRepository.save(new User("Alice Collab", "live_alice_" + ts + "@test.com", passwordEncoder.encode("pass123")));
        bob = userRepository.save(new User("Bob Collab", "live_bob_" + ts + "@test.com", passwordEncoder.encode("pass123")));
        doc = documentRepository.save(new Document("Live Collab Spec", "<p>Initial Text</p>", alice));

        aliceToken = jwtService.generateToken(alice.getEmail());
        bobToken = jwtService.generateToken(bob.getEmail());

        // Grant Bob EDITOR permission on Alice's document
        documentService.updateDocumentPermission(doc.getId(), bob.getId(), bob.getEmail(), Role.EDITOR, alice.getEmail());
    }

    private WebSocketStompClient createStompClient() {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        return stompClient;
    }

    @Test
    void testLiveDocumentEditingAndStyleSyncBetweenUsers() throws Exception {
        WebSocketStompClient clientAlice = createStompClient();
        WebSocketStompClient clientBob = createStompClient();

        String url = "ws://localhost:" + port + "/ws";

        // Alice connects
        StompHeaders headersAlice = new StompHeaders();
        headersAlice.add("Authorization", "Bearer " + aliceToken);
        StompSession sessionAlice = clientAlice.connectAsync(url, new WebSocketHttpHeaders(), headersAlice, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);
        assertTrue(sessionAlice.isConnected(), "Alice failed to connect via WebSocket");

        // Bob connects
        StompHeaders headersBob = new StompHeaders();
        headersBob.add("Authorization", "Bearer " + bobToken);
        StompSession sessionBob = clientBob.connectAsync(url, new WebSocketHttpHeaders(), headersBob, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);
        assertTrue(sessionBob.isConnected(), "Bob failed to connect via WebSocket");

        // Queues to capture received messages
        BlockingQueue<DocumentEditMessage> bobReceivedEdits = new LinkedBlockingQueue<>();
        BlockingQueue<DocumentEditMessage> aliceReceivedEdits = new LinkedBlockingQueue<>();

        // Bob subscribes to document channel
        sessionBob.subscribe("/topic/documents/" + doc.getId(), new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return DocumentEditMessage.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                DocumentEditMessage msg = (DocumentEditMessage) payload;
                if (!bob.getEmail().equals(msg.getSenderEmail())) {
                    bobReceivedEdits.offer(msg);
                }
            }
        });

        // Alice subscribes to document channel
        sessionAlice.subscribe("/topic/documents/" + doc.getId(), new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return DocumentEditMessage.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                DocumentEditMessage msg = (DocumentEditMessage) payload;
                if (!alice.getEmail().equals(msg.getSenderEmail())) {
                    aliceReceivedEdits.offer(msg);
                }
            }
        });

        // Small wait for subscriptions to be acknowledged by broker
        Thread.sleep(300);

        // 1. Alice sends an EDIT message containing styled HTML, math equation, and cursor position
        String aliceStyledHtml = "<h1>Team Math</h1><p><b>Pythagoras:</b> <span class=\"doc-latex-inline\" data-latex=\"a^2+b^2=c^2\">a^2+b^2=c^2</span></p>";
        DocumentEditMessage aliceMsg = new DocumentEditMessage(doc.getId(), "Updated Title", aliceStyledHtml, alice.getEmail(), "Alice Collab", "EDIT");
        aliceMsg.setCursorX(120.0);
        aliceMsg.setCursorY(240.0);

        sessionAlice.send("/app/documents/" + doc.getId() + "/edit", aliceMsg);

        // 2. Bob MUST receive Alice's exact styled edit
        DocumentEditMessage fromAlice = bobReceivedEdits.poll(5, TimeUnit.SECONDS);
        assertNotNull(fromAlice, "Bob did not receive Alice's live edit within timeout!");
        assertEquals(doc.getId(), fromAlice.getDocumentId());
        assertEquals("Alice Collab", fromAlice.getSenderName());
        assertEquals(alice.getEmail(), fromAlice.getSenderEmail());
        assertEquals("EDIT", fromAlice.getType());
        assertEquals(aliceStyledHtml, fromAlice.getContent(), "Alice's styled HTML and LaTeX card failed to sync to Bob!");
        assertEquals(120.0, fromAlice.getCursorX());
        assertEquals(240.0, fromAlice.getCursorY());

        // 3. Bob sends a reply edit / cursor position back to Alice
        String bobEditedHtml = aliceStyledHtml + "<p><b style=\"color:blue;\">Bob verified!</b></p>";
        DocumentEditMessage bobMsg = new DocumentEditMessage(doc.getId(), "Updated Title", bobEditedHtml, bob.getEmail(), "Bob Collab", "EDIT");
        bobMsg.setCursorX(300.0);
        bobMsg.setCursorY(450.0);

        sessionBob.send("/app/documents/" + doc.getId() + "/edit", bobMsg);

        // 4. Alice MUST receive Bob's reply edit
        DocumentEditMessage fromBob = aliceReceivedEdits.poll(5, TimeUnit.SECONDS);
        assertNotNull(fromBob, "Alice did not receive Bob's live edit within timeout!");
        assertEquals(doc.getId(), fromBob.getDocumentId());
        assertEquals("Bob Collab", fromBob.getSenderName());
        assertEquals(bob.getEmail(), fromBob.getSenderEmail());
        assertEquals(bobEditedHtml, fromBob.getContent(), "Bob's styled reply failed to sync to Alice!");

        sessionAlice.disconnect();
        sessionBob.disconnect();
    }

    @Test
    void testLiveCrdtOperationBetweenUsers() throws Exception {
        WebSocketStompClient clientAlice = createStompClient();
        WebSocketStompClient clientBob = createStompClient();

        String url = "ws://localhost:" + port + "/ws";

        StompHeaders headersAlice = new StompHeaders();
        headersAlice.add("Authorization", "Bearer " + aliceToken);
        StompSession sessionAlice = clientAlice.connectAsync(url, new WebSocketHttpHeaders(), headersAlice, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        StompHeaders headersBob = new StompHeaders();
        headersBob.add("Authorization", "Bearer " + bobToken);
        StompSession sessionBob = clientBob.connectAsync(url, new WebSocketHttpHeaders(), headersBob, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<CrdtOperation> bobReceivedCrdt = new LinkedBlockingQueue<>();

        // Bob subscribes to CRDT channel
        sessionBob.subscribe("/topic/documents/" + doc.getId() + "/crdt", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return CrdtOperation.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                bobReceivedCrdt.offer((CrdtOperation) payload);
            }
        });

        Thread.sleep(300);

        // Alice sends a CRDT character insert
        CrdtId id = new CrdtId("alice", 100);
        CrdtOperation op = CrdtOperation.insert(doc.getId(), id, null, null, "Z", alice.getEmail());

        sessionAlice.send("/app/documents/" + doc.getId() + "/crdt", op);

        // Bob receives the CRDT operation
        CrdtOperation receivedOp = bobReceivedCrdt.poll(5, TimeUnit.SECONDS);
        assertNotNull(receivedOp, "Bob did not receive Alice's CRDT operation within timeout!");
        assertEquals("Z", receivedOp.getValue());
        assertEquals(alice.getEmail(), receivedOp.getSenderEmail());
        assertEquals(CrdtOperation.Type.INSERT, receivedOp.getType());

        sessionAlice.disconnect();
        sessionBob.disconnect();
    }

    @Test
    void testLivePresenceHeartbeatBetweenUsers() throws Exception {
        WebSocketStompClient clientAlice = createStompClient();
        WebSocketStompClient clientBob = createStompClient();

        String url = "ws://localhost:" + port + "/ws";

        StompHeaders headersAlice = new StompHeaders();
        headersAlice.add("Authorization", "Bearer " + aliceToken);
        StompSession sessionAlice = clientAlice.connectAsync(url, new WebSocketHttpHeaders(), headersAlice, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        StompHeaders headersBob = new StompHeaders();
        headersBob.add("Authorization", "Bearer " + bobToken);
        StompSession sessionBob = clientBob.connectAsync(url, new WebSocketHttpHeaders(), headersBob, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<Map> bobReceivedPresence = new LinkedBlockingQueue<>();

        sessionBob.subscribe("/topic/documents/" + doc.getId() + "/presence", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                bobReceivedPresence.offer((Map) payload);
            }
        });

        Thread.sleep(300);

        Map<String, Object> presenceMsg = new HashMap<>();
        presenceMsg.put("status", "ACTIVE");
        presenceMsg.put("userName", "Alice Collab");

        sessionAlice.send("/app/documents/" + doc.getId() + "/presence", presenceMsg);

        Map receivedPresence = bobReceivedPresence.poll(5, TimeUnit.SECONDS);
        assertNotNull(receivedPresence, "Bob did not receive Alice's presence update!");
        assertEquals("ACTIVE", receivedPresence.get("status"));
        assertEquals(alice.getEmail(), receivedPresence.get("userEmail"));

        sessionAlice.disconnect();
        sessionBob.disconnect();
    }
}
