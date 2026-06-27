package com.weatherapp.service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

class NotFoundCache {

    private static class CacheEntry {

        final Instant expiry;

        CacheEntry(int ttlSeconds) {
            this.expiry = Instant.now().plusSeconds(ttlSeconds);
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiry);
        }
    }

    private final int ttlSeconds;
    private final ConcurrentHashMap<String, CacheEntry> blocked = new ConcurrentHashMap<>();

    NotFoundCache(int ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    boolean isBlocked(String key) {
        CacheEntry entry = blocked.get(key);
        if (entry == null) {
            return false;
        }
        if (entry.isExpired()) {
            blocked.remove(key, entry);
            return false;
        }
        return true;
    }

    void mark(String key) {
        blocked.put(key, new CacheEntry(ttlSeconds));
    }
}
