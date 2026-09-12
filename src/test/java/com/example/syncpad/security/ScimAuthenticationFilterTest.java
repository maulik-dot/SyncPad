package com.example.syncpad.security;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@ExtendWith(MockitoExtension.class)
class ScimAuthenticationFilterTest {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private ScimAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        filter = new ScimAuthenticationFilter();
        ReflectionTestUtils.setField(filter, "scimToken", "secret_scim_token_999");
    }

    @Test
    void testNonScimEndpoint_bypassesFilter() throws Exception {
        when(request.getRequestURI()).thenReturn("/documents/1");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void testPublicMetadataEndpoints_bypassesAuth() throws Exception {
        when(request.getRequestURI()).thenReturn("/scim/v2/ServiceProviderConfig");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void testProtectedScimUsers_withoutToken_returns401() throws Exception {
        when(request.getRequestURI()).thenReturn("/scim/v2/Users");
        when(request.getHeader("Authorization")).thenReturn(null);
        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilterInternal(request, response, filterChain);

        verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        verify(filterChain, never()).doFilter(request, response);
        assertTrue(sw.toString().contains("urn:ietf:params:scim:api:messages:2.0:Error"));
    }

    @Test
    void testProtectedScimUsers_withValidBearerToken_authenticates() throws Exception {
        when(request.getRequestURI()).thenReturn("/scim/v2/Users");
        when(request.getHeader("Authorization")).thenReturn("Bearer secret_scim_token_999");

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("scim-provisioner", SecurityContextHolder.getContext().getAuthentication().getName());
    }
}
