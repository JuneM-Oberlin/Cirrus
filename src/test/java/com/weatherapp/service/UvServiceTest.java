package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.UvIndex;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class UvServiceTest {

    private static final String UV_JSON = "{\"date\": 1792670400, \"value\": 6.1}";

    @Test
    void nearbyCoordinatesShareOneCachedReading() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getUvJSON(anyDouble(), anyDouble())).thenReturn(UV_JSON);
        AtomicInteger rateLimitCalls = new AtomicInteger();

        UvService service = new UvService(client);
        UvIndex first = service.getUv(39.7392, -104.9847, rateLimitCalls::incrementAndGet);
        UvIndex second = service.getUv(39.7401, -104.9849, rateLimitCalls::incrementAndGet);

        assertEquals("High", first.getCategory());
        assertEquals(first.getValue(), second.getValue());
        verify(client, times(1)).getUvJSON(anyDouble(), anyDouble());
        assertEquals(1, rateLimitCalls.get(), "a cache hit does not spend the rate limit");
    }

    @Test
    void rateLimitStopsTheUpstreamCall() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        UvService service = new UvService(client);

        assertThrows(RateLimitExceededException.class, () -> service.getUv(10.0, 20.0, () -> {
            throw new RateLimitExceededException(RateLimitExceededException.DEFAULT_MESSAGE);
        }));
        verify(client, never()).getUvJSON(anyDouble(), anyDouble());
    }

    @Test
    void failuresAreNotCached() {
        OpenWeatherClient client = mock(OpenWeatherClient.class);
        when(client.getUvJSON(anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("UV API error: 401"))
                .thenReturn(UV_JSON);

        UvService service = new UvService(client);

        assertThrows(RuntimeException.class, () -> service.getUv(1.0, 2.0, () -> {}));
        assertEquals(6.1, service.getUv(1.0, 2.0, () -> {}).getValue());
        verify(client, times(2)).getUvJSON(anyDouble(), anyDouble());
    }
}
