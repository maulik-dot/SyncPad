package com.example.syncpad.integration;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class AuditLogIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    public void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
    }

    private String registerAndGetToken(String name, String email, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", name,
                                "email", email,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        return root.get("token").asText();
    }

    @Test
    public void testWorkspaceAndDocumentActivityTimeline() throws Exception {
        long ts = System.currentTimeMillis();
        String aliceEmail = "alice_audit_" + ts + "@example.com";
        String bobEmail = "bob_audit_" + ts + "@example.com";
        String malloryEmail = "mallory_audit_" + ts + "@example.com";

        String aliceToken = registerAndGetToken("Alice Owner", aliceEmail, "Password123!");
        String bobToken = registerAndGetToken("Bob Collaborator", bobEmail, "Password123!");
        String malloryToken = registerAndGetToken("Mallory Outsider", malloryEmail, "Password123!");

        // 1. Alice creates workspace -> logs WORKSPACE_CREATED
        MvcResult wsRes = mockMvc.perform(post("/workspaces")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Audit Workspace " + ts,
                                "description", "Testing activity feed",
                                "color", "#4F46E5"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        Long wsId = objectMapper.readTree(wsRes.getResponse().getContentAsString()).get("id").asLong();

        // 2. Alice creates document in workspace -> logs DOCUMENT_CREATED
        MvcResult docRes = mockMvc.perform(post("/documents")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Audit Target Document",
                                "content", "Audit Content",
                                "workspaceName", "Audit Workspace " + ts
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        Long docId = objectMapper.readTree(docRes.getResponse().getContentAsString()).get("id").asLong();

        // 3. Alice invites Bob as EDITOR -> logs MEMBER_INVITED
        mockMvc.perform(post("/workspaces/" + wsId + "/share")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", bobEmail,
                                "role", "EDITOR"
                        ))))
                .andExpect(status().isOk());

        // 4. Bob fetches workspace activity -> 200 OK, should include WORKSPACE_CREATED, DOCUMENT_CREATED, MEMBER_INVITED
        mockMvc.perform(get("/workspaces/" + wsId + "/activity?page=0&size=20")
                        .header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[?(@.action == 'MEMBER_INVITED')]").exists())
                .andExpect(jsonPath("$.content[?(@.action == 'WORKSPACE_CREATED')]").exists());

        // 5. Alice fetches document activity -> 200 OK, should include DOCUMENT_CREATED
        mockMvc.perform(get("/documents/" + docId + "/activity?page=0&size=20")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[?(@.action == 'DOCUMENT_CREATED')]").exists());

        // 6. Mallory (outsider) attempts to read workspace activity -> 403 Forbidden
        mockMvc.perform(get("/workspaces/" + wsId + "/activity")
                        .header("Authorization", "Bearer " + malloryToken))
                .andExpect(status().isForbidden());

        // 7. Mallory attempts to read document activity -> 403 Forbidden
        mockMvc.perform(get("/documents/" + docId + "/activity")
                        .header("Authorization", "Bearer " + malloryToken))
                .andExpect(status().isForbidden());
    }
}
