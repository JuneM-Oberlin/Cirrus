package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.model.UvIndex;
import com.weatherapp.service.UvService;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class UvRouteTest {

    private Request request(String lat, String lon) {
        Request req = mock(Request.class);
        when(req.queryParams("lat")).thenReturn(lat);
        when(req.queryParams("lon")).thenReturn(lon);
        when(req.ip()).thenReturn("127.0.0.1");
        return req;
    }

    @Test
    void returnsUvOnSuccess() {
        Request req = request("39.74", "-104.98");
        Response res = mock(Response.class);
        UvService uvService = mock(UvService.class);
        when(uvService.getUv(eq(39.74), eq(-104.98), any(Runnable.class)))
                .thenReturn(new UvIndex(4.8, "Moderate", 1792670400L));

        Object result = WeatherServer.handleUvRoute(req, res, new Gson(), mock(RateLimiter.class), uvService);

        assertTrue(result.toString().contains("\"value\":4.8"));
        assertTrue(result.toString().contains("\"category\":\"Moderate\""));
    }

    @Test
    void returns400WhenCoordinatesMissing() {
        Response res = mock(Response.class);
        UvService uvService = mock(UvService.class);

        Object result = WeatherServer.handleUvRoute(request("", "1"), res, new Gson(), mock(RateLimiter.class), uvService);

        verify(res).status(400);
        assertTrue(result.toString().contains("lat and lon parameters are required."));
        verify(uvService, never()).getUv(anyDouble(), anyDouble(), any(Runnable.class));
    }

    @Test
    void returns400WhenCoordinatesAreNotNumbers() {
        Response res = mock(Response.class);

        Object result = WeatherServer.handleUvRoute(request("north", "1"), res, new Gson(),
                mock(RateLimiter.class), mock(UvService.class));

        verify(res).status(400);
        assertTrue(result.toString().contains("lat and lon must be numbers."));
    }

    @Test
    void returns400WhenCoordinatesAreOffTheMap() {
        Response res = mock(Response.class);

        Object result = WeatherServer.handleUvRoute(request("91", "0"), res, new Gson(),
                mock(RateLimiter.class), mock(UvService.class));

        verify(res).status(400);
        assertTrue(result.toString().contains("lat and lon must be valid coordinates."));
    }

    @Test
    void mapsAnExhaustedLimiterTo429() {
        Request req = request("39.74", "-104.98");
        Response res = mock(Response.class);
        RateLimiter limiter = mock(RateLimiter.class);
        when(limiter.isAllowed("127.0.0.1")).thenReturn(false);
        UvService uvService = mock(UvService.class);
        when(uvService.getUv(anyDouble(), anyDouble(), any(Runnable.class))).thenAnswer(invocation -> {
            Runnable enforce = invocation.getArgument(2);
            enforce.run();
            return new UvIndex(1, "Low", 0);
        });

        Object result = WeatherServer.handleUvRoute(req, res, new Gson(), limiter, uvService);

        verify(res).status(429);
        assertTrue(result.toString().contains("Too many requests"));
    }

    @Test
    void returns503WhenUpstreamFails() {
        Request req = request("39.74", "-104.98");
        Response res = mock(Response.class);
        UvService uvService = mock(UvService.class);
        when(uvService.getUv(anyDouble(), anyDouble(), any(Runnable.class)))
                .thenThrow(new RuntimeException("UV API error: 401"));

        Object result = WeatherServer.handleUvRoute(req, res, new Gson(), mock(RateLimiter.class), uvService);

        verify(res).status(503);
        assertTrue(result.toString().contains("Could not load UV index."));
    }
}
