package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

        when(req.headers("True-Client-Ip")).thenReturn("9.9.9.9");
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
                    throw new RateLimitExceededException("Too many requests. Please wait a minute.");
                });

        org.mockito.Mockito.verify(res).status(429);
        assertTrue(result.toString().contains("Too many requests"));
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
