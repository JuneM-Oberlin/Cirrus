package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.service.AlertService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class AlertsRouteTest {

    @Test
    void returnsAlertsOnSuccess() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        RateLimiter limiter = mock(RateLimiter.class);
        AlertService alertService = mock(AlertService.class);

        when(req.queryParams("lat")).thenReturn("40.7128");
        when(req.queryParams("lon")).thenReturn("-74.0060");
        when(req.ip()).thenReturn("127.0.0.1");
        when(limiter.isAllowed("127.0.0.1")).thenReturn(true);
        when(alertService.getAlerts(40.7128, -74.0060)).thenReturn(List.of());

        Object result = WeatherServer.handleAlertsRoute(req, res, gson, limiter, alertService);

        assertTrue(result.toString().contains("\"alerts\""));
        verify(alertService).getAlerts(40.7128, -74.0060);
    }

    @Test
    void mapsRateLimitTo429() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        RateLimiter limiter = new RateLimiter(clock);
        for (int i = 0; i < 30; i++) {
            limiter.isAllowed("127.0.0.1");
        }

        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        AlertService alertService = mock(AlertService.class);

        when(req.queryParams("lat")).thenReturn("40.7128");
        when(req.queryParams("lon")).thenReturn("-74.0060");
        when(req.ip()).thenReturn("127.0.0.1");

        Object result = WeatherServer.handleAlertsRoute(req, res, gson, limiter, alertService);

        verify(res).status(429);
        assertTrue(result.toString().contains("Too many requests"));
        verify(alertService, never()).getAlerts(anyDouble(), anyDouble());
    }

    @Test
    void returns400WhenLatLonMissing() {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        RateLimiter limiter = mock(RateLimiter.class);
        AlertService alertService = mock(AlertService.class);

        when(req.queryParams("lat")).thenReturn("");
        when(req.queryParams("lon")).thenReturn("-74.0060");

        Object result = WeatherServer.handleAlertsRoute(req, res, gson, limiter, alertService);

        verify(res).status(400);
        assertTrue(result.toString().contains("lat and lon parameters are required."));
    }

    @Test
    void returns503WhenAlertServiceThrows() throws Exception {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        RateLimiter limiter = mock(RateLimiter.class);
        AlertService alertService = mock(AlertService.class);

        when(req.queryParams("lat")).thenReturn("40.7128");
        when(req.queryParams("lon")).thenReturn("-74.0060");
        when(req.ip()).thenReturn("127.0.0.1");
        when(limiter.isAllowed("127.0.0.1")).thenReturn(true);
        when(alertService.getAlerts(40.7128, -74.0060))
                .thenThrow(new RuntimeException("NWS unavailable"));

        Object result = WeatherServer.handleAlertsRoute(req, res, gson, limiter, alertService);

        verify(res).status(503);
        assertTrue(result.toString().contains("Could not load weather alerts."));
    }

    @Test
    void returns400WhenLatLonNotNumeric() {
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        Gson gson = new Gson();
        RateLimiter limiter = mock(RateLimiter.class);
        AlertService alertService = mock(AlertService.class);

        when(req.queryParams("lat")).thenReturn("not-a-number");
        when(req.queryParams("lon")).thenReturn("-74.0060");

        Object result = WeatherServer.handleAlertsRoute(req, res, gson, limiter, alertService);

        verify(res).status(400);
        assertTrue(result.toString().contains("lat and lon must be numbers."));
    }
}
