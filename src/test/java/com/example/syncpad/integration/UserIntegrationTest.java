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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class UserIntegrationTest {

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

    private String registerAndGetToken(String email, String name, String password) throws Exception {
        var registerReq = Map.of(
                "name", name,
                "email", email,
                "password", password
        );

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return root.get("token").asText();
    }

    @Test
    public void testGetCurrentUserProfile_Unauthenticated() throws Exception {
        mockMvc.perform(get("/users/me"))
                .andExpect(status().isForbidden());
    }

    @Test
    public void testUserManagementLifecycle() throws Exception {
        String email = "user_mgmt_" + System.currentTimeMillis() + "@example.com";
        String token = registerAndGetToken(email, "Initial Name", "OldPassword123!");

        // 1. GET /users/me
        mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.name").value("Initial Name"))
                .andExpect(jsonPath("$.provider").value("LOCAL"))
                .andExpect(jsonPath("$.createdAt").exists());

        // 2. PUT /users/me (Update Profile)
        var updateReq = Map.of(
                "name", "Updated Display Name",
                "profilePictureUrl", "https://syncpad.internal/avatars/user1.png"
        );

        mockMvc.perform(put("/users/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Display Name"))
                .andExpect(jsonPath("$.profilePictureUrl").value("https://syncpad.internal/avatars/user1.png"));

        // 3. POST /users/me/password with wrong current password -> 400
        var wrongPassReq = Map.of(
                "oldPassword", "WrongPass123!",
                "newPassword", "NewPassword789!"
        );

        mockMvc.perform(post("/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongPassReq)))
                .andExpect(status().isBadRequest());

        // 4. POST /users/me/password with valid change -> 200
        var validPassReq = Map.of(
                "oldPassword", "OldPassword123!",
                "newPassword", "NewPassword789!"
        );

        mockMvc.perform(post("/users/me/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validPassReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password changed successfully"));

        // 5. Verify login with new password succeeds
        var loginWithNew = Map.of(
                "email", email,
                "password", "NewPassword789!"
        );

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginWithNew)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());

        // 6. GET /users/search
        mockMvc.perform(get("/users/search")
                        .param("q", "Updated Display")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value(email))
                .andExpect(jsonPath("$[0].name").value("Updated Display Name"));
    }
}
