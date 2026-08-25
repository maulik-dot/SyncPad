package com.example.syncpad.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.example.syncpad.entity.Role;
import com.example.syncpad.entity.User;
import com.example.syncpad.entity.Workspace;
import com.example.syncpad.entity.WorkspacePermission;
import com.example.syncpad.repository.NotificationRepository;
import com.example.syncpad.repository.UserRepository;
import com.example.syncpad.repository.WorkspacePermissionRepository;
import com.example.syncpad.repository.WorkspaceRepository;
import com.example.syncpad.security.JwtService;

@SpringBootTest
public class NotificationIntegrationTest {

    @Autowired private WebApplicationContext webApplicationContext;
    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspacePermissionRepository workspacePermissionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private MockMvc mockMvc;
    private User userA;
    private User userB;
    private Workspace workspaceA;
    private String tokenA;
    private String tokenB;
    private String emailA;
    private String emailB;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();

        long ts = System.currentTimeMillis();
        emailA = "inviter_" + ts + "@test.com";
        emailB = "recipient_" + ts + "@test.com";

        userA = userRepository.save(new User("Alice Inviter", emailA, passwordEncoder.encode("pass123")));
        userB = userRepository.save(new User("Bob Recipient", emailB, passwordEncoder.encode("pass123")));

        workspaceA = workspaceRepository.save(new Workspace("Alice Team " + ts, "Desc", "#2563eb", "A", userA));
        workspacePermissionRepository.save(new WorkspacePermission(workspaceA, userA, Role.OWNER));

        tokenA = jwtService.generateToken(userA.getEmail());
        tokenB = jwtService.generateToken(userB.getEmail());
    }

    @Test
    void testInviteAcceptanceFlow() throws Exception {
        // 1. User A invites User B to workspace
        String invitePayload = String.format("""
            {
                "email": "%s",
                "role": "EDITOR"
            }
        """, emailB);

        mockMvc.perform(post("/workspaces/" + workspaceA.getId() + "/invite")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.recipientEmail").value(emailB))
                .andExpect(jsonPath("$.targetRole").value("EDITOR"));

        // 2. User B fetches notifications
        mockMvc.perform(get("/notifications")
                .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Workspace Invitation"))
                .andExpect(jsonPath("$[0].status").value("PENDING"));

        var notifications = notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(emailB);
        assertEquals(1, notifications.size());
        Long notifId = notifications.get(0).getId();

        // 3. User B accepts the invitation
        mockMvc.perform(post("/notifications/" + notifId + "/accept")
                .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        // 4. Verify User B now has WorkspacePermission in the DB
        var perm = workspacePermissionRepository.findByUserAndWorkspace(userB, workspaceA);
        assertTrue(perm.isPresent());
        assertEquals(Role.EDITOR, perm.get().getRole());

        // 5. Verify User A received an acceptance notification
        var inviterNotifs = notificationRepository.findByRecipientEmailOrderByCreatedAtDesc(emailA);
        assertFalse(inviterNotifs.isEmpty());
        assertEquals("Invitation Accepted", inviterNotifs.get(0).getTitle());
    }
}
