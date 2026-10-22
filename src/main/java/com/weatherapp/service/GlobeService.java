package com.weatherapp.service;

import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.GlobeCity;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.GlobeRegion;
import com.weatherapp.model.WeatherData;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Current weather for the globe's fixed cities, one region at a time.
 *
 * Budget rules, so a look at the globe never burns the rate limit:
 * each city is cached for 30 minutes (shared by every visitor), a single
 * request fetches at most MAX_FETCHES_PER_REQUEST uncached cities, every
 * upstream call goes through the caller's rate limit, and a city that
 * could not be fetched comes back as "pending" for the page to retry.
 */
public class GlobeService {

    static final int MAX_FETCHES_PER_REQUEST = 8;
    private static final int CACHE_TTL_SECONDS = 1800;

    private final OpenWeatherClient client;
    private final Map<String, List<GlobeCity>> regions;
    private final WeatherCache<GlobeMarker> cache;
    private final WeatherResponseParser parser;
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public GlobeService(OpenWeatherClient client) {
        this(client, GlobeCities.byRegion());
    }

    GlobeService(OpenWeatherClient client, Map<String, List<GlobeCity>> regions) {
        this.client = client;
        this.regions = regions;
        this.cache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.parser = new WeatherResponseParser();
    }

    public boolean hasRegion(String region) {
        return regions.containsKey(region);
    }

    public GlobeRegion getRegion(String region, Runnable enforceRateLimit) {
        List<GlobeCity> cities = regions.get(region);
        if (cities == null) {
            throw new IllegalArgumentException("Unknown region: " + region);
        }

        List<GlobeMarker> markers = new ArrayList<>();
        int fetches = 0;
        boolean rateLimited = false;

        for (GlobeCity city : cities) {
            String key = city.getName();
            GlobeMarker cached = cache.get(key);
            if (cached != null) {
                markers.add(cached);
                continue;
            }
            if (rateLimited || fetches >= MAX_FETCHES_PER_REQUEST) {
                markers.add(GlobeMarker.pending(city));
                continue;
            }

            fetches++;
            try {
                markers.add(load(city, enforceRateLimit));
            } catch (RateLimitExceededException e) {
                rateLimited = true;
                markers.add(GlobeMarker.pending(city));
            } catch (Exception e) {
                System.err.println("Globe city failed (" + city.getName() + "): " + e.getMessage());
                markers.add(GlobeMarker.pending(city));
            }
        }
        return new GlobeRegion(region, markers);
    }

    // One upstream call per uncached city; concurrent requests share it.
    private GlobeMarker load(GlobeCity city, Runnable enforceRateLimit) {
        String key = city.getName();
        Object lock = loadLocks.computeIfAbsent(key, k -> new Object());
        synchronized (lock) {
            try {
                GlobeMarker cached = cache.get(key);
                if (cached != null) {
                    return cached;
                }
                enforceRateLimit.run();
                WeatherData weather = parser.parseWeather(
                        client.getWeatherByCoordsJSON(city.getLat(), city.getLon()));
                GlobeMarker marker = GlobeMarker.withWeather(city, weather);
                cache.put(key, marker);
                return marker;
            } finally {
                loadLocks.remove(key, lock);
            }
        }
    }
}
