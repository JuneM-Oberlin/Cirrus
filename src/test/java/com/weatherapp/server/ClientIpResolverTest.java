package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import spark.Request;

class ClientIpResolverTest {

    @Test
    void usesXForwardedForWhenProxyTrusted() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.1");

        assertEquals("203.0.113.1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void takesRightmostHopOfMultiValueXForwardedFor() {
        // Only the rightmost entry is appended by our own proxy; earlier
        // entries could be client-supplied and spoofed.
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.99, 198.51.100.7");

        assertEquals("198.51.100.7", ClientIpResolver.resolve(req, true));
    }

    @Test
    void ignoresXForwardedForWhenProxyNotTrusted() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.99");
        when(req.ip()).thenReturn("10.21.157.68");

        assertEquals("10.21.157.68", ClientIpResolver.resolve(req, false));
    }

    @Test
    void fallsBackToRequestIpWhenXForwardedForMissing() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn(null);
        when(req.ip()).thenReturn("127.0.0.1");

        assertEquals("127.0.0.1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void rejectsMalformedXForwardedForEntry() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.99, not an ip");
        when(req.ip()).thenReturn("127.0.0.1");

        assertEquals("127.0.0.1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void stripsIpv6BracketsFromXForwardedFor() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn("[2001:db8::1]");

        assertEquals("2001:db8::1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void stripsIpv6BracketsFromRequestIp() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn(null);
        when(req.ip()).thenReturn("[2001:db8::1]");

        assertEquals("2001:db8::1", ClientIpResolver.resolve(req, false));
    }

    @Test
    void returnsUnknownWhenNoIpAvailable() {
        Request req = mock(Request.class);
        when(req.headers("X-Forwarded-For")).thenReturn(" ");
        when(req.ip()).thenReturn(null);

        assertEquals("unknown", ClientIpResolver.resolve(req, true));
    }
}
