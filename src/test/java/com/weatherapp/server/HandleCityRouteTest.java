package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.error.RateLimitExceededException;
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
                    return java.util.Map.of("city", city);
                });

        assertTrue(result.toString().contains("London"));
    }

    @Test
    void mapsCityNotFoundTo404() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.headers("X-Forwarded-For")).thenReturn(null);
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

        org.mockito.Mockito.verify(res).status(404);
        assertTrue(result.toString().contains("City not found."));
    }

    @Test
    void mapsRateLimitTo429() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.headers("X-Forwarded-For")).thenReturn(null);
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

        org.mockito.Mockito.verify(res).status(429);
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
    void rateLimitCheckPassesWhenLimiterAllows() {
        RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.isAllowed("127.0.0.1")).thenReturn(true);

        Runnable check = WeatherServer.rateLimitCheck(limiter, "127.0.0.1");
        check.run();
    }

    @Test
    void mapsUnexpectedErrorTo500() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();

        when(req.headers("X-Forwarded-For")).thenReturn(null);
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

        org.mockito.Mockito.verify(res).status(500);
        assertTrue(result.toString().contains("Something went wrong."));
    }
}
