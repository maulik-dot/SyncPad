package com.example.syncpad.security;

public interface RateLimiterStore {
    boolean isAllowed(String key, int limit, long windowMs);
    long getRetryAfterSeconds(String key, long windowMs);
}
