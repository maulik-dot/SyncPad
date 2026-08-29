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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class DocumentCommentIntegrationTest {

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
    public void testFullCommentLifecycleAndPermissions() throws Exception {
        long ts = System.currentTimeMillis();
        String aliceEmail = "alice_cmt_" + ts + "@example.com";
        String bobEmail = "bob_cmt_" + ts + "@example.com";
        String malloryEmail = "mallory_cmt_" + ts + "@example.com";

        String aliceToken = registerAndGetToken("Alice Owner", aliceEmail, "Password123!");
        String bobToken = registerAndGetToken("Bob Collaborator", bobEmail, "Password123!");
        String malloryToken = registerAndGetToken("Mallory Outsider", malloryEmail, "Password123!");

        // 1. Alice creates workspace
        MvcResult wsRes = mockMvc.perform(post("/workspaces")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Comment Test Workspace " + ts,
                                "description", "Testing comments",
                                "color", "#4F46E5"
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        Long wsId = objectMapper.readTree(wsRes.getResponse().getContentAsString()).get("id").asLong();

        // 2. Alice creates document in workspace
        MvcResult docRes = mockMvc.perform(post("/documents")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "Commented Architecture RFC",
                                "content", "System Architecture Details",
                                "workspaceName", "Comment Test Workspace " + ts
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        Long docId = objectMapper.readTree(docRes.getResponse().getContentAsString()).get("id").asLong();

        // 3. Mallory (outsider) attempts to comment -> 403 Forbidden
        mockMvc.perform(post("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + malloryToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Unauthorized intrusion attempt"
                        ))))
                .andExpect(status().isForbidden());

        // 4. Alice shares workspace with Bob as EDITOR
        mockMvc.perform(post("/workspaces/" + wsId + "/share")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", bobEmail,
                                "role", "EDITOR"
                        ))))
                .andExpect(status().isOk());

        // 5. Bob posts a top-level comment
        MvcResult commentRes = mockMvc.perform(post("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Please review database pooling size.",
                                "anchorText", "System Architecture"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.text").value("Please review database pooling size."))
                .andExpect(jsonPath("$.authorName").value("Bob Collaborator"))
                .andExpect(jsonPath("$.resolved").value(false))
                .andReturn();

        Long commentId = objectMapper.readTree(commentRes.getResponse().getContentAsString()).get("id").asLong();

        // 6. Alice lists comments
        mockMvc.perform(get("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(commentId));

        // 7. Alice resolves the comment
        mockMvc.perform(patch("/documents/" + docId + "/comments/" + commentId + "/resolve")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolved").value(true));

        // 8. Bob replies to resolved comment
        mockMvc.perform(post("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + bobToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "text", "Agreed and verified.",
                                "parentId", commentId
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(commentId));

        // 9. Alice deletes the comment thread
        mockMvc.perform(delete("/documents/" + docId + "/comments/" + commentId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isNoContent());

        // 10. Verify comments list is now empty
        mockMvc.perform(get("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
