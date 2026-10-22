package com.weatherapp.service;

import com.weatherapp.model.UvIndex;

/**
 * Caches today's UV index by rounded coordinate. UV is a daily figure, so
 * an hour-long cache is plenty fresh and keeps upstream calls rare; the
 * rate limit is only spent when the cache misses.
 */
public class UvService {

    private static final int CACHE_TTL_SECONDS = 3600;

    private final WeatherCache<UvIndex> cache;
    private final OpenWeatherClient client;
    private final UvParser parser;

    public UvService(OpenWeatherClient client) {
        this.client = client;
        this.cache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.parser = new UvParser();
    }

    public UvIndex getUv(double lat, double lon, Runnable enforceRateLimit) {
        // Two decimals is about 1 km: close enough for a daily UV reading.
        String key = String.format("%.2f,%.2f", lat, lon);

        UvIndex cached = cache.get(key);
        if (cached != null) {
            return cached;
        }

        enforceRateLimit.run();
        UvIndex uv = parser.parse(client.getUvJSON(lat, lon));
        cache.put(key, uv);
        return uv;
    }
}
