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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.micrometer.core.instrument.MeterRegistry;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
public class AiIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private MeterRegistry meterRegistry;

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
    public void testAiGenerationPersistenceAndPrometheusMetrics() throws Exception {
        long ts = System.currentTimeMillis();
        String aliceEmail = "alice_ai_" + ts + "@example.com";
        String malloryEmail = "mallory_ai_" + ts + "@example.com";

        String aliceToken = registerAndGetToken("Alice Author", aliceEmail, "Password123!");
        String malloryToken = registerAndGetToken("Mallory Outsider", malloryEmail, "Password123!");

        // 1. Create a document for Alice
        MvcResult docRes = mockMvc.perform(post("/documents")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "AI Architecture Spec",
                                "content", "SyncPad integrates AI seamlessly with state synchronisation."
                        ))))
                .andExpect(status().isOk())
                .andReturn();

        Long docId = objectMapper.readTree(docRes.getResponse().getContentAsString()).get("id").asLong();

        // 2. Perform AI generate call (Option A + D verification)
        mockMvc.perform(post("/api/ai/generate")
                        .header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "documentId", docId,
                                "action", "SUMMARIZE",
                                "tone", "professional"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").exists())
                .andExpect(jsonPath("$.action").value("SUMMARIZE"))
                .andExpect(jsonPath("$.estimatedTokens").isNumber())
                .andExpect(jsonPath("$.latencyMs").isNumber());

        // 3. Query AI generation history for this document (Option A)
        mockMvc.perform(get("/api/ai/history?documentId=" + docId)
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].documentId").value(docId))
                .andExpect(jsonPath("$.content[0].action").value("SUMMARIZE"))
                .andExpect(jsonPath("$.content[0].tone").value("professional"))
                .andExpect(jsonPath("$.content[0].isStream").value(false));

        // 4. Query AI generation history for the user overall
        mockMvc.perform(get("/api/ai/history")
                        .header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content.length()").value(1));

        // 5. Mallory (outsider) attempting to access Alice's document AI history should receive 403
        mockMvc.perform(get("/api/ai/history?documentId=" + docId)
                        .header("Authorization", "Bearer " + malloryToken))
                .andExpect(status().isForbidden());

        // 6. Verify Prometheus metrics (Option D)
        if (meterRegistry != null) {
            var counter = meterRegistry.find("ai.requests.total")
                    .tags("action", "SUMMARIZE", "mode", "sync", "status", "success")
                    .counter();
            assertNotNull(counter, "Counter ai.requests.total should exist");
            assertTrue(counter.count() >= 1.0, "ai.requests.total count should be at least 1");

            var timer = meterRegistry.find("ai.request.duration")
                    .tags("action", "SUMMARIZE", "mode", "sync")
                    .timer();
            assertNotNull(timer, "Timer ai.request.duration should exist");
            assertTrue(timer.count() >= 1, "ai.request.duration count should be at least 1");
        }
    }
}

