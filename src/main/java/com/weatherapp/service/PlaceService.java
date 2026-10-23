package com.weatherapp.service;

import com.weatherapp.model.Place;
import java.util.List;

/**
 * Place search for the search screen. Town names don't move, so matches are
 * cached for a day per search, shared by every visitor; the rate limit is
 * only spent when the cache misses.
 */
public class PlaceService {

    private static final int CACHE_TTL_SECONDS = 24 * 60 * 60;

    private final WeatherCache<List<Place>> cache;
    private final OpenWeatherClient client;
    private final PlaceParser parser;

    public PlaceService(OpenWeatherClient client) {
        this.client = client;
        this.cache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.parser = new PlaceParser();
    }

    public List<Place> getPlaces(String query, Runnable enforceRateLimit) {
        String key = query.toLowerCase().trim();

        List<Place> cached = cache.get(key);
        if (cached != null) {
            return cached;
        }

        enforceRateLimit.run();
        List<Place> places = parser.parse(client.getPlacesJSON(query.trim()));
        cache.put(key, places);
        return places;
    }
}
