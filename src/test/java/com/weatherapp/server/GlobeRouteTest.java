package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.model.GlobeCity;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.GlobeRegion;
import com.weatherapp.service.GlobeService;
import java.util.List;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class GlobeRouteTest {

    private Request request(String region) {
        Request req = mock(Request.class);
        when(req.queryParams("region")).thenReturn(region);
        when(req.ip()).thenReturn("127.0.0.1");
        return req;
    }

    @Test
    void returnsTheRegionsMarkers() {
        Response res = mock(Response.class);
        GlobeService service = mock(GlobeService.class);
        when(service.hasRegion("europe")).thenReturn(true);
        GlobeMarker paris = GlobeMarker.pending(new GlobeCity("Paris", "europe", 48.86, 2.35));
        when(service.getRegion(eq("europe"), any(Runnable.class)))
                .thenReturn(new GlobeRegion("europe", List.of(paris)));

        Object result = WeatherServer.handleGlobeRoute(request("europe"), res, new Gson(),
                mock(RateLimiter.class), service);

        assertTrue(result.toString().contains("\"region\":\"europe\""));
        assertTrue(result.toString().contains("\"name\":\"Paris\""));
        assertTrue(result.toString().contains("\"pending\":true"));
    }

    @Test
    void returns400WithoutARegion() {
        Response res = mock(Response.class);
        GlobeService service = mock(GlobeService.class);

        Object result = WeatherServer.handleGlobeRoute(request(" "), res, new Gson(), mock(RateLimiter.class), service);

        verify(res).status(400);
        assertTrue(result.toString().contains("region parameter is required."));
        verify(service, never()).getRegion(anyString(), any(Runnable.class));
    }

    @Test
    void returns400ForAnUnknownRegion() {
        Response res = mock(Response.class);
        GlobeService service = mock(GlobeService.class);
        when(service.hasRegion("atlantis")).thenReturn(false);

        Object result = WeatherServer.handleGlobeRoute(request("atlantis"), res, new Gson(),
                mock(RateLimiter.class), service);

        verify(res).status(400);
        assertTrue(result.toString().contains("Unknown region."));
    }

    @Test
    void returns503WhenTheServiceFails() {
        Response res = mock(Response.class);
        GlobeService service = mock(GlobeService.class);
        when(service.hasRegion("asia")).thenReturn(true);
        when(service.getRegion(eq("asia"), any(Runnable.class))).thenThrow(new RuntimeException("boom"));

        Object result = WeatherServer.handleGlobeRoute(request("asia"), res, new Gson(), mock(RateLimiter.class), service);

        verify(res).status(503);
        assertTrue(result.toString().contains("Could not load the globe."));
    }
}
