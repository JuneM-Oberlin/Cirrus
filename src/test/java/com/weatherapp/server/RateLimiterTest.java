package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void allowsUpToThirtyRequestsPerWindow() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        RateLimiter limiter = new RateLimiter(clock);

        for (int i = 0; i < 30; i++) {
            assertTrue(limiter.isAllowed("1.2.3.4"), "request " + (i + 1));
        }
        assertFalse(limiter.isAllowed("1.2.3.4"));
    }

    @Test
    void resetsWindowAfterExpiry() {
        Clock clock = mock(Clock.class);
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant afterWindow = start.plusSeconds(61);
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();

        when(clock.instant()).thenAnswer(invocation ->
                calls.incrementAndGet() < 32 ? start : afterWindow);

        RateLimiter limiter = new RateLimiter(clock);

        for (int i = 0; i < 30; i++) {
            assertTrue(limiter.isAllowed("9.9.9.9"));
        }
        assertFalse(limiter.isAllowed("9.9.9.9"));

        assertTrue(limiter.isAllowed("9.9.9.9"));
    }

    @Test
    void tracksIpsIndependently() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        RateLimiter limiter = new RateLimiter(clock);

        for (int i = 0; i < 30; i++) {
            assertTrue(limiter.isAllowed("1.1.1.1"));
        }
        assertFalse(limiter.isAllowed("1.1.1.1"));
        assertTrue(limiter.isAllowed("2.2.2.2"));
    }

    @Test
    void prunesWhenTrackedIpCountExceedsLimit() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        RateLimiter limiter = new RateLimiter(clock);

        for (int i = 0; i < 501; i++) {
            assertTrue(limiter.isAllowed("10.0.0." + (i % 256)));
        }
    }
}
