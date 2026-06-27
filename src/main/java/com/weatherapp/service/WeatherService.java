package com.weatherapp.service;

import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.model.ForecastDay;
import com.weatherapp.model.WeatherData;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

public class WeatherService {

    private static final int CACHE_TTL_SECONDS = 600;
    private static final int NOT_FOUND_CACHE_TTL_SECONDS = 60;

    private final WeatherCache<WeatherData> weatherCache;
    private final WeatherCache<List<ForecastDay>> forecastCache;
    private final NotFoundCache notFoundCache;
    private final OpenWeatherClient client;
    private final WeatherResponseParser weatherParser;
    private final ForecastParser forecastParser;
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public WeatherService(OpenWeatherClient client) {
        this.client = client;
        this.weatherCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.forecastCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.notFoundCache = new NotFoundCache(NOT_FOUND_CACHE_TTL_SECONDS);
        this.weatherParser = new WeatherResponseParser();
        this.forecastParser = new ForecastParser();
    }

    public WeatherData getWeather(String city, Runnable enforceRateLimit) {
        return fetchCached(
                city,
                weatherCache,
                "weather:",
                enforceRateLimit,
                client::getWeatherJSON,
                weatherParser::parseWeather);
    }

    public List<ForecastDay> getForecast(String city, Runnable enforceRateLimit) {
        return fetchCached(
                city,
                forecastCache,
                "forecast:",
                enforceRateLimit,
                client::getForecastJSON,
                forecastParser::parseForecast);
    }

    private <T> T fetchCached(
            String city,
            WeatherCache<T> cache,
            String lockPrefix,
            Runnable enforceRateLimit,
            Function<String, String> fetchJson,
            Function<String, T> parse) {

        String key = normalizeCityKey(city);

        T cached = cache.get(key);
        if (cached != null) {
            System.out.println("Cache hit: " + lockPrefix.replace(':', '/') + key);
            return cached;
        }

        String lockKey = lockPrefix + key;
        Object lock = loadLocks.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            try {
                cached = cache.get(key);
                if (cached != null) {
                    return cached;
                }

                if (notFoundCache.isBlocked(key)) {
                    throw new CityNotFoundException(city);
                }

                enforceRateLimit.run();

                String json = fetchJson.apply(city);
                T data = parse.apply(json);
                cache.put(key, data);
                return data;
            } catch (CityNotFoundException e) {
                notFoundCache.mark(key);
                throw e;
            } finally {
                loadLocks.remove(lockKey, lock);
            }
        }
    }

    private static String normalizeCityKey(String city) {
        return city.toLowerCase().trim();
    }
}
