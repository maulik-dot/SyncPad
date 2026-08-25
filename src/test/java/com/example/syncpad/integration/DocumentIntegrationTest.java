package com.example.syncpad.integration;

import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class DocumentIntegrationTest {

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

    @Test
    public void testDocumentLifecycle() throws Exception {
        String ownerEmail = "doc_owner_" + System.currentTimeMillis() + "@example.com";
        var regReq = java.util.Map.of("name", "Doc Owner", "email", ownerEmail, "password", "Password123!");

        String regContent = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String token = objectMapper.readTree(regContent).get("token").asText();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(ownerEmail, null, Collections.emptyList())
        );

        // 1. Create Document
        var createReq = java.util.Map.of("title", "Integration Doc", "content", "Initial Content");
        String createContent = mockMvc.perform(post("/documents")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Integration Doc"))
                .andReturn().getResponse().getContentAsString();

        long docId = objectMapper.readTree(createContent).get("id").asLong();

        // 2. Update Document
        var updateReq = java.util.Map.of("title", "Updated Integration Doc", "content", "Updated Content");
        mockMvc.perform(put("/documents/" + docId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Integration Doc"));

        // 3. Fetch Version History
        mockMvc.perform(get("/documents/" + docId + "/versions")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // 4. Restore Version 1
        mockMvc.perform(post("/documents/" + docId + "/restore/1")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Integration Doc"));

        // 5. Fetch Document Detail & Stats
        mockMvc.perform(get("/documents/" + docId + "/detail")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(docId))
                .andExpect(jsonPath("$.title").value("Integration Doc"))
                .andExpect(jsonPath("$.stats.wordCount").value(2))
                .andExpect(jsonPath("$.stats.characterCount").value(15))
                .andExpect(jsonPath("$.currentUserRole").value("OWNER"));

        mockMvc.perform(get("/documents/" + docId + "/stats")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(docId))
                .andExpect(jsonPath("$.wordCount").value(2))
                .andExpect(jsonPath("$.readingTimeMinutes").value(1));

        // 6. Fast Rename via PATCH and PUT
        var renameReq = java.util.Map.of("title", "Fast Renamed Doc");
        mockMvc.perform(patch("/documents/" + docId + "/rename")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renameReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Fast Renamed Doc"));

        // 7. Comments Engine (Create Thread, Reply, Resolve, Delete)
        var commentReq = java.util.Map.of("text", "Please review section 2", "anchorText", "section 2");
        String commentContent = mockMvc.perform(post("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentReq)))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Please review section 2"))
                .andExpect(jsonPath("$.anchorText").value("section 2"))
                .andReturn().getResponse().getContentAsString();

        long commentId = objectMapper.readTree(commentContent).get("id").asLong();

        // Reply to comment
        var replyReq = java.util.Map.of("text", "Looks good to me!", "parentId", commentId);
        mockMvc.perform(post("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Looks good to me!"));

        // Fetch comments list
        mockMvc.perform(get("/documents/" + docId + "/comments")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].replies.length()").value(1));

        // Resolve comment
        mockMvc.perform(patch("/documents/" + docId + "/comments/" + commentId + "/resolve")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolved").value(true));

        // 8. PDF Attachment (Attach & Detach)
        var attachPdfReq = java.util.Map.of("fileName", "architecture-spec.pdf", "pdfUrl", "https://example.com/spec.pdf");
        mockMvc.perform(post("/documents/" + docId + "/pdf")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(attachPdfReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pdfFileName").value("architecture-spec.pdf"));

        mockMvc.perform(delete("/documents/" + docId + "/pdf")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
