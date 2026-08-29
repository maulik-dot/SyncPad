package com.example.syncpad.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.syncpad.dto.scim.ScimListResponse;
import com.example.syncpad.dto.scim.ScimPatchRequest;
import com.example.syncpad.dto.scim.ScimUserDto;
import com.example.syncpad.service.ScimService;

@RestController
@RequestMapping("/scim/v2")
public class ScimController {

    private final ScimService scimService;

    public ScimController(ScimService scimService) {
        this.scimService = scimService;
    }

    @GetMapping("/ServiceProviderConfig")
    public ResponseEntity<Map<String, Object>> getServiceProviderConfig() {
        return ResponseEntity.ok(Map.of(
                "schemas", List.of("urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"),
                "patch", Map.of("supported", true),
                "bulk", Map.of("supported", false),
                "filter", Map.of("supported", true, "maxResults", 100),
                "changePassword", Map.of("supported", false),
                "sort", Map.of("supported", false),
                "etag", Map.of("supported", false),
                "authenticationSchemes", List.of(
                        Map.of("name", "OAuth Bearer Token", "type", "oauthbearertoken", "description", "Authentication scheme using the OAuth Bearer Token standard")
                )
        ));
    }

    @GetMapping("/Schemas")
    public ResponseEntity<Map<String, Object>> getSchemas() {
        return ResponseEntity.ok(Map.of(
                "schemas", List.of("urn:ietf:params:scim:api:messages:2.0:ListResponse"),
                "totalResults", 1,
                "itemsPerPage", 1,
                "startIndex", 1,
                "Resources", List.of(
                        Map.of(
                                "id", "urn:ietf:params:scim:schemas:core:2.0:User",
                                "name", "User",
                                "description", "User Account Schema"
                        )
                )
        ));
    }

    @GetMapping("/Users")
    public ResponseEntity<ScimListResponse<ScimUserDto>> getUsers(
            @RequestParam(required = false) String filter,
            @RequestParam(defaultValue = "1") int startIndex,
            @RequestParam(defaultValue = "20") int count
    ) {
        return ResponseEntity.ok(scimService.listUsers(filter, startIndex, count));
    }

    @PostMapping("/Users")
    public ResponseEntity<ScimUserDto> createUser(@RequestBody ScimUserDto dto) {
        ScimUserDto created = scimService.createUser(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/Users/{id}")
    public ResponseEntity<ScimUserDto> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(scimService.getUser(id));
    }

    @PutMapping("/Users/{id}")
    public ResponseEntity<ScimUserDto> updateUser(@PathVariable Long id, @RequestBody ScimUserDto dto) {
        return ResponseEntity.ok(scimService.updateUser(id, dto));
    }

    @PatchMapping("/Users/{id}")
    public ResponseEntity<ScimUserDto> patchUser(@PathVariable Long id, @RequestBody ScimPatchRequest patchRequest) {
        return ResponseEntity.ok(scimService.patchUser(id, patchRequest));
    }

    @DeleteMapping("/Users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        scimService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
