package com.weatherapp.server;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class RateLimiter {

    private static final int MAX_REQUESTS = 30;   // per window
    private static final int WINDOW_SECONDS = 60;  // 1 minute
    private static final int MAX_TRACKED_IPS = 500;

    private static class Window {

        final AtomicInteger count = new AtomicInteger(0);
        Instant resetAt;

        Window(Instant now) {
            this.resetAt = now.plusSeconds(WINDOW_SECONDS);
        }
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    public boolean isAllowed(String ip) {
        Instant now = clock.instant();
        Window previous = windows.get(ip);
        boolean expired = previous != null && now.isAfter(previous.resetAt);

        Window window = windows.compute(ip, (key, existing) -> {
            if (existing == null || now.isAfter(existing.resetAt)) {
                return new Window(now);
            }
            return existing;
        });

        if (expired || windows.size() > MAX_TRACKED_IPS) {
            pruneExpired(now);
        }

        return window.count.incrementAndGet() <= MAX_REQUESTS;
    }

    private void pruneExpired(Instant now) {
        windows.entrySet().removeIf(entry -> now.isAfter(entry.getValue().resetAt));
    }
}

