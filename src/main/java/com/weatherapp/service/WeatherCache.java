package com.weatherapp.service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

class WeatherCache<T> {

    private static class CacheEntry<T> {

        final T data;
        final Instant expiry;

        CacheEntry(T data, int ttlSeconds) {
            this.data = data;
            this.expiry = Instant.now().plusSeconds(ttlSeconds);
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiry);
        }
    }

    private final int ttlSeconds;
    private final ConcurrentHashMap<String, CacheEntry<T>> cache = new ConcurrentHashMap<>();

    WeatherCache(int ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    T get(String key) {
        CacheEntry<T> cached = cache.get(key);
        if (cached == null || cached.isExpired()) {
            return null;
        }
        return cached.data;
    }

    void put(String key, T value) {
        cache.put(key, new CacheEntry<>(value, ttlSeconds));
    }
}

