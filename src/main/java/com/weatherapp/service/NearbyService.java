package com.weatherapp.service;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.weatherapp.model.GlobeCity;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.WeatherData;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The towns around a point on the globe, each with its current weather, from
 * a single upstream call. Points are snapped to a grid about 5 km across so
 * neighbouring looks share one cached answer for ten minutes.
 */
public class NearbyService {

    static final int TOWN_COUNT = 30;
    static final double GRID_DEGREES = 0.05;
    private static final int CACHE_TTL_SECONDS = 600;

    private final OpenWeatherClient client;
    private final WeatherCache<List<GlobeMarker>> cache;
    private final WeatherResponseParser parser;
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public NearbyService(OpenWeatherClient client) {
        this.client = client;
        this.cache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.parser = new WeatherResponseParser();
    }

    public List<GlobeMarker> getNearby(double lat, double lon, Runnable enforceRateLimit) {
        double gridLat = snap(lat);
        double gridLon = snap(lon);
        String key = String.format("%.2f,%.2f", gridLat, gridLon);

        List<GlobeMarker> cached = cache.get(key);
        if (cached != null) {
            return cached;
        }

        Object lock = loadLocks.computeIfAbsent(key, k -> new Object());
        synchronized (lock) {
            try {
                cached = cache.get(key);
                if (cached != null) {
                    return cached;
                }
                enforceRateLimit.run();
                List<GlobeMarker> towns = parse(client.getNearbyJSON(gridLat, gridLon, TOWN_COUNT));
                cache.put(key, towns);
                return towns;
            } finally {
                loadLocks.remove(key, lock);
            }
        }
    }

    static double snap(double degrees) {
        return Math.round(degrees / GRID_DEGREES) * GRID_DEGREES;
    }

    // Each entry in the list looks like a /weather answer, so the same parser
    // reads it. A town listed twice keeps its nearest entry, and trailer and
    // RV parks (which the list includes) are left out.
    List<GlobeMarker> parse(String json) {
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonArray list = root.getAsJsonArray("list");
        if (list == null) {
            throw new RuntimeException("Invalid nearby response: missing list");
        }

        List<GlobeMarker> towns = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonElement element : list) {
            WeatherData weather = parser.parseWeather(element.toString());
            String name = weather.getCity();
            if (isCampground(name) || !seen.add(name)) {
                continue;
            }
            GlobeCity town = new GlobeCity(name, "nearby", weather.getLat(), weather.getLon());
            towns.add(GlobeMarker.withWeather(town, weather));
        }
        return towns;
    }

    private static boolean isCampground(String name) {
        String lower = name.toLowerCase();
        return lower.contains("mobile home park") || lower.contains("trailer park") || lower.contains("rv park");
    }
}
