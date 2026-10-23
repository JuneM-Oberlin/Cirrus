package com.weatherapp.service;

import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.model.ForecastDay;
import com.weatherapp.model.SixHourForecast;
import com.weatherapp.model.WeatherData;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.function.Supplier;

public class WeatherService {

    private static final int CACHE_TTL_SECONDS = 600;
    private static final int NOT_FOUND_CACHE_TTL_SECONDS = 60;

    private final WeatherCache<WeatherData> weatherCache;
    // Raw 3-hour forecast JSON, shared by the daily and six-hour views so
    // both cost a single upstream call per city.
    private final WeatherCache<String> forecastJsonCache;
    private final NotFoundCache notFoundCache;
    private final OpenWeatherClient client;
    private final WeatherResponseParser weatherParser;
    private final ForecastParser forecastParser;
    private final SixHourParser sixHourParser;
    private final ConcurrentHashMap<String, Object> loadLocks = new ConcurrentHashMap<>();

    public WeatherService(OpenWeatherClient client) {
        this.client = client;
        this.weatherCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.forecastJsonCache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.notFoundCache = new NotFoundCache(NOT_FOUND_CACHE_TTL_SECONDS);
        this.weatherParser = new WeatherResponseParser();
        this.forecastParser = new ForecastParser();
        this.sixHourParser = new SixHourParser();
    }

    public WeatherData getWeather(String city, Runnable enforceRateLimit) {
        return fetchCached(
                normalizeCityKey(city),
                city,
                weatherCache,
                "weather:",
                enforceRateLimit,
                () -> client.getWeatherJSON(city),
                weatherParser::parseWeather);
    }

    public List<ForecastDay> getForecast(String city, Runnable enforceRateLimit) {
        return forecastParser.parseForecast(getForecastJson(city, enforceRateLimit));
    }

    public SixHourForecast getSixHour(String city, Runnable enforceRateLimit) {
        return sixHourParser.parse(getForecastJson(city, enforceRateLimit));
    }

    // The same three lookups by position, for places picked from a list or
    // the globe, where a name alone could mean the wrong town.

    public WeatherData getWeatherAt(double lat, double lon, Runnable enforceRateLimit) {
        return fetchCached(
                pointKey(lat, lon),
                lat + "," + lon,
                weatherCache,
                "weather:",
                enforceRateLimit,
                () -> client.getWeatherByCoordsJSON(lat, lon),
                weatherParser::parseWeather);
    }

    public List<ForecastDay> getForecastAt(double lat, double lon, Runnable enforceRateLimit) {
        return forecastParser.parseForecast(getForecastJsonAt(lat, lon, enforceRateLimit));
    }

    public SixHourForecast getSixHourAt(double lat, double lon, Runnable enforceRateLimit) {
        return sixHourParser.parse(getForecastJsonAt(lat, lon, enforceRateLimit));
    }

    private String getForecastJson(String city, Runnable enforceRateLimit) {
        return fetchCached(
                normalizeCityKey(city),
                city,
                forecastJsonCache,
                "forecast:",
                enforceRateLimit,
                () -> client.getForecastJSON(city),
                this::validateForecastJson);
    }

    private String getForecastJsonAt(double lat, double lon, Runnable enforceRateLimit) {
        return fetchCached(
                pointKey(lat, lon),
                lat + "," + lon,
                forecastJsonCache,
                "forecast:",
                enforceRateLimit,
                () -> client.getForecastByCoordsJSON(lat, lon),
                this::validateForecastJson);
    }

    // Parse once before caching so a malformed response is never cached.
    private String validateForecastJson(String json) {
        forecastParser.parseForecast(json);
        sixHourParser.parse(json);
        return json;
    }

    // key names the cache entry; label is what a "not found" error reports.
    private <T> T fetchCached(
            String key,
            String label,
            WeatherCache<T> cache,
            String lockPrefix,
            Runnable enforceRateLimit,
            Supplier<String> fetchJson,
            Function<String, T> parse) {

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
                    throw new CityNotFoundException(label);
                }

                enforceRateLimit.run();

                String json = fetchJson.get();
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

    // Three decimals is about 100 m. The "@" keeps these keys apart from city names.
    private static String pointKey(double lat, double lon) {
        return String.format("@%.3f,%.3f", lat, lon);
    }
}
