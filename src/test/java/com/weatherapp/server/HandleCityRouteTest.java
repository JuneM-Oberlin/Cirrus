package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.service.OpenWeatherClient;
import com.weatherapp.service.WeatherService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class HandleCityRouteTest {

    @Test
    void returns200JsonOnSuccess() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.ip()).thenReturn("1.2.3.4");

        Object result = WeatherServer.handleCityRoute(
                req,
                res,
                gson,
                "London",
                "City not found.",
                (city, ip) -> {
                    assertEquals("London", city);
                    assertEquals("1.2.3.4", ip);
                    return Map.of("city", city);
                });

        assertTrue(result.toString().contains("London"));
    }

    @Test
    void mapsCityNotFoundTo404() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.ip()).thenReturn("127.0.0.1");

        Object result = WeatherServer.handleCityRoute(
                req,
                res,
                gson,
                "Nowhere",
                "City not found.",
                (city, ip) -> {
                    throw new CityNotFoundException(city);
                });

        verify(res).status(404);
        assertTrue(result.toString().contains("City not found."));
    }

    @Test
    void mapsRateLimitTo429() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.ip()).thenReturn("127.0.0.1");

        Object result = WeatherServer.handleCityRoute(
                req,
                res,
                gson,
                "London",
                "City not found.",
                (city, ip) -> {
                    throw new RateLimitExceededException(RateLimitExceededException.DEFAULT_MESSAGE);
                });

        verify(res).status(429);
        assertTrue(result.toString().contains("Too many requests"));
    }

    @Test
    void rateLimitCheckThrowsWhenLimiterRejects() {
        RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.isAllowed("127.0.0.1")).thenReturn(false);

        Runnable check = WeatherServer.rateLimitCheck(limiter, "127.0.0.1");

        assertThrows(RateLimitExceededException.class, check::run);
    }

    @Test
    void routeReturns429WhenServiceRateLimitCallbackRejects() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        RateLimiter limiter = new RateLimiter(clock);
        for (int i = 0; i < 30; i++) {
            assertTrue(limiter.isAllowed("127.0.0.1"));
        }

        OpenWeatherClient client = mock(OpenWeatherClient.class);
        WeatherService service = new WeatherService(client);

        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        when(req.ip()).thenReturn("127.0.0.1");

        Object result = WeatherServer.handleCityRoute(
                req,
                res,
                gson,
                "London",
                "City not found.",
                (city, ip) -> service.getWeather(city, WeatherServer.rateLimitCheck(limiter, ip)));

        verify(res).status(429);
        assertTrue(result.toString().contains("Too many requests"));
        verify(client, never()).getWeatherJSON("London");
    }

    @Test
    void mapsUnexpectedErrorTo500() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.ip()).thenReturn("127.0.0.1");

        Object result = WeatherServer.handleCityRoute(
                req,
                res,
                gson,
                "London",
                "City not found.",
                (city, ip) -> {
                    throw new RuntimeException("boom");
                });

        verify(res).status(500);
        assertTrue(result.toString().contains("Something went wrong."));
    }
}
