package com.example.syncpad.security;

import java.io.IOException;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Filter that enforces RFC 7644 OAuth Bearer Token authentication on SCIM v2 endpoints.
 * Protects user provisioning (/scim/v2/Users/**) from unauthenticated internet access.
 */
@Component
public class ScimAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ScimAuthenticationFilter.class);

    @Value("${app.scim.token:${SCIM_BEARER_TOKEN:}}")
    private String scimToken;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Only inspect /scim/v2 endpoints
        if (!path.startsWith("/scim/v2")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Allow public metadata discovery per RFC 7644
        if (path.equals("/scim/v2/ServiceProviderConfig") || path.equals("/scim/v2/Schemas")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check for existing valid authentication (e.g. from JwtAuthenticationFilter)
        Authentication currentAuth = SecurityContextHolder.getContext().getAuthentication();
        if (currentAuth != null && currentAuth.isAuthenticated()
                && !"anonymousUser".equals(currentAuth.getPrincipal())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check for SCIM Bearer Token
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String incomingToken = authHeader.substring(7).trim();

            if (scimToken != null && !scimToken.isBlank() && scimToken.trim().equals(incomingToken)) {
                UsernamePasswordAuthenticationToken scimAuth = new UsernamePasswordAuthenticationToken(
                        "scim-provisioner",
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"), new SimpleGrantedAuthority("ROLE_SCIM"))
                );
                SecurityContextHolder.getContext().setAuthentication(scimAuth);
                filterChain.doFilter(request, response);
                return;
            }
        }

        // Unauthorized access to SCIM endpoints
        log.warn("Unauthorized attempt to access SCIM endpoint: {} from remote IP: {}", path, request.getRemoteAddr());
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/scim+json;charset=UTF-8");
        response.getWriter().write("""
            {
              "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
              "status": "401",
              "detail": "Unauthorized: Valid SCIM Bearer token or Admin credentials required"
            }
            """);
    }
}
