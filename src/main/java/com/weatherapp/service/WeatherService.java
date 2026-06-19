package com.weatherapp.service;

import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.ForecastDay;
import com.weatherapp.model.WeatherData;
import com.weatherapp.server.RateLimiter;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

public class WeatherService {

    private static final int CACHE_TTL_SECONDS = 600;
    private static final int NOT_FOUND_CACHE_TTL_SECONDS = 60;
    private static final String RATE_LIMIT_MESSAGE = "Too many requests. Please wait a minute.";

    private final WeatherCache<WeatherData> weatherCache;
    private final WeatherCache<List<ForecastDay>> forecastCache;
    private final WeatherCache<Boolean> notFoundCache;
    private final OpenWeatherClient client;
    private final WeatherResponseParser weatherParser;
    private final ForecastParser forecastParser;
    private final RateLimiter rateLimiter;
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public WeatherService(OpenWeatherClient client, RateLimiter rateLimiter) {
        this.client = client;
        this.rateLimiter = rateLimiter;
        this.weatherCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.forecastCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.notFoundCache = new WeatherCache<>(NOT_FOUND_CACHE_TTL_SECONDS);
        this.weatherParser = new WeatherResponseParser();
        this.forecastParser = new ForecastParser();
    }

    public WeatherData getWeather(String city, String clientIp) {
        String key = normalizeCityKey(city);

        WeatherData cached = weatherCache.get(key);
        if (cached != null) {
            System.out.println("Cache hit: weather/" + key);
            return cached;
        }

        String lockKey = "weather:" + key;
        Object lock = loadLocks.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            try {
                cached = weatherCache.get(key);
                if (cached != null) {
                    return cached;
                }

                checkNotFoundCache(key, city);

                enforceRateLimit(clientIp);

                String json = client.getWeatherJSON(city);
                WeatherData data = weatherParser.parseWeather(json);
                weatherCache.put(key, data);
                return data;
            } catch (CityNotFoundException e) {
                notFoundCache.put(key, true);
                throw e;
            } finally {
                loadLocks.remove(lockKey, lock);
            }
        }
    }

    public List<ForecastDay> getForecast(String city, String clientIp) {
        String key = normalizeCityKey(city);

        List<ForecastDay> cached = forecastCache.get(key);
        if (cached != null) {
            System.out.println("Cache hit: forecast/" + key);
            return cached;
        }

        String lockKey = "forecast:" + key;
        Object lock = loadLocks.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            try {
                cached = forecastCache.get(key);
                if (cached != null) {
                    return cached;
                }

                checkNotFoundCache(key, city);

                enforceRateLimit(clientIp);

                String json = client.getForecastJSON(city);
                List<ForecastDay> data = forecastParser.parseForecast(json);
                forecastCache.put(key, data);
                return data;
            } catch (CityNotFoundException e) {
                notFoundCache.put(key, true);
                throw e;
            } finally {
                loadLocks.remove(lockKey, lock);
            }
        }
    }

    private void checkNotFoundCache(String key, String city) {
        if (notFoundCache.get(key) != null) {
            throw new CityNotFoundException(city);
        }
    }

    private void enforceRateLimit(String clientIp) {
        if (!rateLimiter.isAllowed(clientIp)) {
            throw new RateLimitExceededException(RATE_LIMIT_MESSAGE);
        }
    }

    private static String normalizeCityKey(String city) {
        return city.toLowerCase().trim();
    }
}
