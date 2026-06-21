package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.model.ForecastDay;
import com.weatherapp.model.WeatherData;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class WeatherServiceTest {

    private static final String VALID_WEATHER_JSON = """
            {
              "name": "London",
              "main": {
                "temp": 70.0,
                "feels_like": 68.0,
                "humidity": 50,
                "pressure": 1013.0,
                "temp_min": 65.0,
                "temp_max": 75.0
              },
              "weather": [{"description": "clear sky", "icon": "01d", "id": 800}],
              "wind": {"speed": 5.0, "deg": 180},
              "coord": {"lat": 51.5, "lon": -0.1},
              "sys": {"sunrise": 1, "sunset": 2},
              "clouds": {"all": 10},
              "visibility": 10000
            }
            """;

    private static final String VALID_FORECAST_JSON = """
            {
              "list": [
                {
                  "dt_txt": "2024-06-18 12:00:00",
                  "main": {"temp_max": 75.0, "temp_min": 60.0},
                  "weather": [{"description": "clear sky", "icon": "01d", "id": 800}],
                  "wind": {"speed": 5.0},
                  "pop": 0.1
                }
              ]
            }
            """;

    @Test
    void cacheHitSkipsRateLimit() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherJSON("London")).thenReturn(VALID_WEATHER_JSON);

        AtomicInteger rateLimitCalls = new AtomicInteger();
        Runnable enforceRateLimit = rateLimitCalls::incrementAndGet;

        WeatherService service = new WeatherService(client);

        WeatherData first = service.getWeather("London", enforceRateLimit);
        WeatherData second = service.getWeather("London", enforceRateLimit);

        assertEquals("London", first.getCity());
        assertEquals(first.getCity(), second.getCity());
        assertEquals(1, rateLimitCalls.get());
        verify(client, times(1)).getWeatherJSON("London");
    }

    @Test
    void cacheMissEnforcesRateLimit() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherJSON("Paris")).thenReturn(VALID_WEATHER_JSON.replace("London", "Paris"));

        AtomicInteger rateLimitCalls = new AtomicInteger();
        Runnable enforceRateLimit = rateLimitCalls::incrementAndGet;

        WeatherService service = new WeatherService(client);
        service.getWeather("Paris", enforceRateLimit);

        assertEquals(1, rateLimitCalls.get());
    }

    @Test
    void negativeCacheAvoidsRepeatApiCalls() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherJSON("Nowhere")).thenThrow(new CityNotFoundException("Nowhere"));

        AtomicInteger rateLimitCalls = new AtomicInteger();
        Runnable enforceRateLimit = rateLimitCalls::incrementAndGet;

        WeatherService service = new WeatherService(client);

        assertThrows(CityNotFoundException.class, () -> service.getWeather("Nowhere", enforceRateLimit));
        assertThrows(CityNotFoundException.class, () -> service.getWeather("Nowhere", enforceRateLimit));

        verify(client, times(1)).getWeatherJSON("Nowhere");
        assertEquals(1, rateLimitCalls.get());
    }

    @Test
    void concurrentMissesOnlyFetchOnce() throws Exception {
        OpenWeatherClient client = mock(OpenWeatherClient.class);

        AtomicInteger callCount = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        when(client.getWeatherJSON("Berlin")).thenAnswer(invocation -> {
            callCount.incrementAndGet();
            started.countDown();
            release.await();
            return VALID_WEATHER_JSON.replace("London", "Berlin");
        });

        WeatherService service = new WeatherService(client);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        try {
            Future<WeatherData> first = pool.submit(() -> service.getWeather("Berlin", () -> {}));
            Future<WeatherData> second = pool.submit(() -> service.getWeather("Berlin", () -> {}));

            started.await();
            release.countDown();

            assertEquals("Berlin", first.get().getCity());
            assertEquals("Berlin", second.get().getCity());
            assertEquals(1, callCount.get());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentWeatherAndForecastUseSeparateLocks() throws Exception {
        OpenWeatherClient client = mock(OpenWeatherClient.class);

        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger maxInFlight = new AtomicInteger();

        when(client.getWeatherJSON("Tokyo")).thenAnswer(invocation -> {
            int current = inFlight.incrementAndGet();
            maxInFlight.updateAndGet(max -> Math.max(max, current));
            release.await(2, TimeUnit.SECONDS);
            inFlight.decrementAndGet();
            return VALID_WEATHER_JSON.replace("London", "Tokyo");
        });
        when(client.getForecastJSON("Tokyo")).thenAnswer(invocation -> {
            int current = inFlight.incrementAndGet();
            maxInFlight.updateAndGet(max -> Math.max(max, current));
            release.await(2, TimeUnit.SECONDS);
            inFlight.decrementAndGet();
            return VALID_FORECAST_JSON;
        });

        WeatherService service = new WeatherService(client);
        ExecutorService pool = Executors.newFixedThreadPool(2);

        try {
            Future<WeatherData> weather = pool.submit(() -> service.getWeather("Tokyo", () -> {}));
            Future<List<ForecastDay>> forecast = pool.submit(() -> service.getForecast("Tokyo", () -> {}));

            Thread.sleep(100);
            release.countDown();

            weather.get(2, TimeUnit.SECONDS);
            forecast.get(2, TimeUnit.SECONDS);
            assertEquals(2, maxInFlight.get());
        } finally {
            pool.shutdownNow();
        }
    }
}
