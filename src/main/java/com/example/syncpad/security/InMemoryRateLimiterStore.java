package com.example.syncpad.security;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class InMemoryRateLimiterStore implements RateLimiterStore {

    private static final int MAX_BUCKETS = 10000;
    private static final long DEFAULT_MAX_WINDOW_MS = 3600000; // 1 hour max retention

    private static class RateWindow {
        final long windowStart;
        final AtomicInteger count;

        RateWindow(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(1);
        }
    }

    private final Map<String, RateWindow> requestBuckets = new ConcurrentHashMap<>();

    @Override
    public boolean isAllowed(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();

        if (requestBuckets.size() > MAX_BUCKETS) {
            purgeOldest(now, windowMs);
        }

        RateWindow window = requestBuckets.compute(key, (k, existing) -> {
            if (existing == null || (now - existing.windowStart) > windowMs) {
                return new RateWindow(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });

        return window.count.get() <= limit;
    }

    @Override
    public long getRetryAfterSeconds(String key, long windowMs) {
        RateWindow window = requestBuckets.get(key);
        if (window == null) return 1;
        long elapsed = System.currentTimeMillis() - window.windowStart;
        return Math.max(1, (windowMs - elapsed) / 1000);
    }

    @Scheduled(fixedRate = 60000)
    public void pruneExpiredBuckets() {
        long now = System.currentTimeMillis();
        requestBuckets.entrySet().removeIf(entry -> (now - entry.getValue().windowStart) > DEFAULT_MAX_WINDOW_MS);
    }

    private void purgeOldest(long now, long windowMs) {
        requestBuckets.entrySet().removeIf(entry -> (now - entry.getValue().windowStart) > windowMs);
    }
}
