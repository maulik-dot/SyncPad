package com.example.syncpad.security;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.MockitoAnnotations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import jakarta.servlet.ServletException;

class RateLimitingFilterAiTest {

    @Mock
    private RateLimiterStore rateLimiterStore;

    private RateLimitingFilter rateLimitingFilter;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        rateLimitingFilter = new RateLimitingFilter(rateLimiterStore);
        ReflectionTestUtils.setField(rateLimitingFilter, "aiLimit", 5);
    }

    @Test
    void doFilterInternal_aiEndpointAllowed_passesChain() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/ai/generate");
        request.setRemoteAddr("127.0.0.1");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        when(rateLimiterStore.isAllowed(eq("127.0.0.1:ai"), eq(5), anyLong())).thenReturn(true);

        rateLimitingFilter.doFilterInternal(request, response, filterChain);

        assertEquals(200, response.getStatus());
        verify(rateLimiterStore).isAllowed(eq("127.0.0.1:ai"), eq(5), anyLong());
    }

    @Test
    void doFilterInternal_aiEndpointExceeded_returns429() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/ai/stream");
        request.setRemoteAddr("192.168.1.10");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        when(rateLimiterStore.isAllowed(eq("192.168.1.10:ai"), eq(5), anyLong())).thenReturn(false);
        when(rateLimiterStore.getRetryAfterSeconds(eq("192.168.1.10:ai"), anyLong())).thenReturn(30L);

        rateLimitingFilter.doFilterInternal(request, response, filterChain);

        assertEquals(429, response.getStatus());
        assertEquals("30", response.getHeader("Retry-After"));
    }

    @Test
    void doFilterInternal_nonRateLimitedEndpoint_bypassesStore() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/health");
        request.setRemoteAddr("127.0.0.1");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();

        rateLimitingFilter.doFilterInternal(request, response, filterChain);

        assertEquals(200, response.getStatus());
        verify(rateLimiterStore, never()).isAllowed(anyString(), anyInt(), anyLong());
    }

    private static String anyString() {
        return org.mockito.ArgumentMatchers.anyString();
    }
}
