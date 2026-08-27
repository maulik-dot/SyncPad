package com.example.syncpad.security;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimiterStore rateLimiterStore;

    @Value("${syncpad.ratelimit.login-limit:30}")
    private int loginLimit = 30;

    @Value("${syncpad.ratelimit.register-limit:25}")
    private int registerLimit = 25;

    @Value("${syncpad.ratelimit.share-limit:100}")
    private int shareLimit = 100;

    @Value("${syncpad.ratelimit.ws-limit:120}")
    private int wsLimit = 120;

    private static final long WINDOW_MS = 60_000L;

    public RateLimitingFilter(RateLimiterStore rateLimiterStore) {
        this.rateLimiterStore = rateLimiterStore;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        int limit = getLimitForPath(path);

        if (limit > 0) {
            String clientIp = getClientIp(request);
            String bucketKey = clientIp + ":" + getPathBucketPrefix(path);

            boolean allowed = rateLimiterStore.isAllowed(bucketKey, limit, WINDOW_MS);
            if (!allowed) {
                long retryAfterSec = rateLimiterStore.getRetryAfterSeconds(bucketKey, WINDOW_MS);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", String.valueOf(retryAfterSec));
                response.getWriter().write(String.format(
                        "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Try again in %d seconds.\"}",
                        retryAfterSec
                ));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private int getLimitForPath(String path) {
        if (path.startsWith("/auth/login")) return loginLimit;
        if (path.startsWith("/auth/register")) return registerLimit;
        if (path.startsWith("/documents/share/")) return shareLimit;
        if (path.startsWith("/ws")) return wsLimit;
        return -1;
    }

    private String getPathBucketPrefix(String path) {
        if (path.startsWith("/auth/login")) return "login";
        if (path.startsWith("/auth/register")) return "register";
        if (path.startsWith("/documents/share/")) return "share";
        if (path.startsWith("/ws")) return "ws";
        return "general";
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
