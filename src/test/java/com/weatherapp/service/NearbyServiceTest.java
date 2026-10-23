package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.weatherapp.model.GlobeMarker;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class NearbyServiceTest {

    private static String town(String name, double lat, double lon, double temp) {
        return """
                {"name": "%s", "coord": {"lat": %s, "lon": %s},
                 "main": {"temp": %s, "feels_like": 40.0, "humidity": 80, "pressure": 1015,
                          "temp_min": 40.0, "temp_max": 44.0},
                 "weather": [{"id": 701, "description": "mist", "icon": "50n"}],
                 "wind": {"speed": 3.0, "deg": 200}, "clouds": {"all": 90}, "sys": {"country": "US"},
                 "rain": null, "snow": null}
                """.formatted(name, lat, lon, temp);
    }

    private static final String NEAR_OBERLIN = "{\"list\": ["
            + town("Elyria", 41.368, -82.108, 41.3) + ","
            + town("Oberlin", 41.294, -82.217, 42.7) + ","
            + town("Lorain", 41.333, -82.150, 41.1) + ","
            + town("Lorain", 41.453, -82.182, 43.4) + ","
            + town("Erie West Mobile Home Park", 41.439, -82.242, 41.7) + "]}";

    @Test
    void readsTownsWithWeatherSkippingRepeatsAndTrailerParks() {
        NearbyService service = new NearbyService(mock(OpenWeatherClient.class));

        List<GlobeMarker> towns = service.parse(NEAR_OBERLIN);

        assertEquals(List.of("Elyria", "Oberlin", "Lorain"), towns.stream().map(GlobeMarker::getName).toList());
        GlobeMarker oberlin = towns.get(1);
        assertEquals(41.294, oberlin.getLat());
        assertEquals(42.7, oberlin.getTemperature());
        assertEquals(701, oberlin.getConditionId());
        assertEquals("50n", oberlin.getWeatherCode());
        assertFalse(oberlin.isPending());
        assertEquals(41.333, towns.get(2).getLat(), "the nearer Lorain is kept");
    }

    @Test
    void nearbyLooksShareOneCachedCallPerGridCell() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getNearbyJSON(anyDouble(), anyDouble(), anyInt())).thenReturn(NEAR_OBERLIN);
        AtomicInteger rateLimitCalls = new AtomicInteger();
        NearbyService service = new NearbyService(client);

        service.getNearby(41.351, -82.001, rateLimitCalls::incrementAndGet);
        service.getNearby(41.349, -81.999, rateLimitCalls::incrementAndGet);

        assertEquals(1, rateLimitCalls.get());
        verify(client, times(1)).getNearbyJSON(eq(NearbyService.snap(41.35)), eq(NearbyService.snap(-82.0)),
                eq(NearbyService.TOWN_COUNT));
    }
}
