package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.GlobeCity;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.GlobeRegion;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class GlobeServiceTest {

    private static final String WEATHER_JSON = """
            {
              "name": "Somewhere",
              "main": {"temp": 71.6, "feels_like": 70.0, "humidity": 40, "pressure": 1012.0,
                       "temp_min": 70.0, "temp_max": 73.0},
              "weather": [{"description": "clear sky", "icon": "01d", "id": 800}],
              "wind": {"speed": 4.0, "deg": 90}
            }
            """;

    private static Map<String, List<GlobeCity>> region(String name, int size) {
        List<GlobeCity> cities = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            cities.add(new GlobeCity("City " + i, name, i, i));
        }
        return Map.of(name, cities);
    }

    @Test
    void fixedCityListStaysWithinThePerRequestCap() {
        Map<String, List<GlobeCity>> regions = GlobeCities.byRegion();
        Set<String> names = new HashSet<>();

        assertEquals(6, regions.size());
        regions.forEach((regionName, cities) -> {
            assertFalse(cities.isEmpty(), regionName + " has cities");
            assertTrue(cities.size() <= GlobeService.MAX_FETCHES_PER_REQUEST,
                    regionName + " fits in one request");
            for (GlobeCity city : cities) {
                assertTrue(names.add(city.getName()), "unique name " + city.getName());
                assertTrue(city.getLat() >= -90 && city.getLat() <= 90);
                assertTrue(city.getLon() >= -180 && city.getLon() <= 180);
                assertEquals(regionName, city.getRegion());
            }
        });
    }

    @Test
    void returnsMarkersWithWeatherAndCachesThem() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherByCoordsJSON(anyDouble(), anyDouble())).thenReturn(WEATHER_JSON);
        AtomicInteger rateLimitCalls = new AtomicInteger();
        GlobeService service = new GlobeService(client, region("test", 3));

        GlobeRegion first = service.getRegion("test", rateLimitCalls::incrementAndGet);
        GlobeRegion second = service.getRegion("test", rateLimitCalls::incrementAndGet);

        assertEquals("test", first.getRegion());
        assertEquals(3, first.getCities().size());
        GlobeMarker marker = first.getCities().get(1);
        assertEquals("City 1", marker.getName(), "our display name, not the API's");
        assertFalse(marker.isPending());
        assertEquals(71.6, marker.getTemperature());
        assertEquals(800, marker.getConditionId());
        assertEquals("01d", marker.getWeatherCode());
        assertEquals(3, second.getCities().size());
        assertEquals(3, rateLimitCalls.get(), "the second look is all cache hits");
        verify(client, times(3)).getWeatherByCoordsJSON(anyDouble(), anyDouble());
    }

    @Test
    void capsUpstreamCallsPerRequestAndFillsTheRestNextTime() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherByCoordsJSON(anyDouble(), anyDouble())).thenReturn(WEATHER_JSON);
        GlobeService service = new GlobeService(client, region("big", 10));

        List<GlobeMarker> first = service.getRegion("big", () -> {}).getCities();
        long pending = first.stream().filter(GlobeMarker::isPending).count();
        assertEquals(2, pending);
        assertNull(first.get(9).getTemperature());
        assertEquals(9.0, first.get(9).getLat(), "pending markers still carry their position");

        List<GlobeMarker> second = service.getRegion("big", () -> {}).getCities();
        assertEquals(0, second.stream().filter(GlobeMarker::isPending).count());
        verify(client, times(10)).getWeatherByCoordsJSON(anyDouble(), anyDouble());
    }

    @Test
    void aTrippedRateLimitMarksTheRestPendingInsteadOfFailing() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherByCoordsJSON(anyDouble(), anyDouble())).thenReturn(WEATHER_JSON);
        GlobeService service = new GlobeService(client, region("test", 4));
        AtomicInteger allowed = new AtomicInteger(2);

        List<GlobeMarker> markers = service.getRegion("test", () -> {
            if (allowed.getAndDecrement() <= 0) {
                throw new RateLimitExceededException(RateLimitExceededException.DEFAULT_MESSAGE);
            }
        }).getCities();

        assertFalse(markers.get(0).isPending());
        assertFalse(markers.get(1).isPending());
        assertTrue(markers.get(2).isPending());
        assertTrue(markers.get(3).isPending());
        verify(client, times(2)).getWeatherByCoordsJSON(anyDouble(), anyDouble());
    }

    @Test
    void oneFailingCityDoesNotSinkTheRegion() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getWeatherByCoordsJSON(anyDouble(), anyDouble())).thenReturn(WEATHER_JSON);
        when(client.getWeatherByCoordsJSON(eq(1.0), eq(1.0))).thenThrow(new RuntimeException("Weather API error: 500"));
        GlobeService service = new GlobeService(client, region("test", 3));

        List<GlobeMarker> markers = service.getRegion("test", () -> {}).getCities();

        assertFalse(markers.get(0).isPending());
        assertTrue(markers.get(1).isPending());
        assertFalse(markers.get(2).isPending());
    }

    @Test
    void unknownRegionIsRejected() {
        GlobeService service = new GlobeService(mock(OpenWeatherClient.class), region("test", 1));
        assertFalse(service.hasRegion("atlantis"));
        assertThrows(IllegalArgumentException.class, () -> service.getRegion("atlantis", () -> {}));
    }
}
