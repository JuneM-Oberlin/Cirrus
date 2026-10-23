package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.weatherapp.model.Place;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PlaceServiceTest {

    private static final String CANTON = """
            [{"name": "Canton", "lat": 40.799, "lon": -81.378, "country": "US", "state": "Ohio"}]
            """;

    @Test
    void cachesEachSearchAndOnlySpendsTheRateLimitOnAMiss() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getPlacesJSON("Canton")).thenReturn(CANTON);
        AtomicInteger rateLimitCalls = new AtomicInteger();
        PlaceService service = new PlaceService(client);

        List<Place> first = service.getPlaces("Canton", rateLimitCalls::incrementAndGet);
        List<Place> second = service.getPlaces("  canton ", rateLimitCalls::incrementAndGet);

        assertEquals("Ohio", first.get(0).getState());
        assertEquals(first, second, "a differently typed search shares the cached answer");
        assertEquals(1, rateLimitCalls.get());
        verify(client, times(1)).getPlacesJSON("Canton");
    }
}
