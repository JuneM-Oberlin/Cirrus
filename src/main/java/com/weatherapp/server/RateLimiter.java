package com.weatherapp.server;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
            prune(now);
        }

        return window.count.incrementAndGet() <= MAX_REQUESTS;
    }

    int trackedIpCount() {
        return windows.size();
    }

    private void prune(Instant now) {
        windows.entrySet().removeIf(entry -> now.isAfter(entry.getValue().resetAt));

        if (windows.size() <= MAX_TRACKED_IPS) {
            return;
        }

        List<Map.Entry<String, Window>> entries = new ArrayList<>(windows.entrySet());
        entries.sort(Comparator.comparing(entry -> entry.getValue().resetAt));

        int toRemove = windows.size() - MAX_TRACKED_IPS;
        for (int i = 0; i < toRemove; i++) {
            windows.remove(entries.get(i).getKey());
        }
    }
}
