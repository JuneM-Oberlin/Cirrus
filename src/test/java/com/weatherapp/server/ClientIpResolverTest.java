package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import spark.Request;

class ClientIpResolverTest {

    @Test
    void usesTrueClientIpHeaderOnRender() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn("203.0.113.1");

        assertEquals("203.0.113.1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void usesCfConnectingIpWhenTrueClientIpMissingOnRender() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn(null);
        when(req.headers("CF-Connecting-IP")).thenReturn("198.51.100.2");

        assertEquals("198.51.100.2", ClientIpResolver.resolve(req, true));
    }

    @Test
    void prefersTrueClientIpOverSpoofedXForwardedForOnRender() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn("81.97.145.24");
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.99, 10.0.0.1");

        assertEquals("81.97.145.24", ClientIpResolver.resolve(req, true));
    }

    @Test
    void ignoresTrustedHeadersLocally() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn("203.0.113.1");
        when(req.headers("CF-Connecting-IP")).thenReturn("198.51.100.2");
        when(req.ip()).thenReturn("10.21.157.68");

        assertEquals("10.21.157.68", ClientIpResolver.resolve(req, false));
    }

    @Test
    void ignoresSpoofedXForwardedFor() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn(null);
        when(req.headers("CF-Connecting-IP")).thenReturn(null);
        when(req.headers("X-Forwarded-For")).thenReturn("203.0.113.99, 10.0.0.1");
        when(req.ip()).thenReturn("10.21.157.68");

        assertEquals("10.21.157.68", ClientIpResolver.resolve(req, false));
    }

    @Test
    void stripsIpv6BracketsFromRequestIp() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn(null);
        when(req.headers("CF-Connecting-IP")).thenReturn(null);
        when(req.ip()).thenReturn("[2001:db8::1]");

        assertEquals("2001:db8::1", ClientIpResolver.resolve(req, false));
    }

    @Test
    void stripsIpv6BracketsFromTrustedHeaderOnRender() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn("[2001:db8::1]");

        assertEquals("2001:db8::1", ClientIpResolver.resolve(req, true));
    }

    @Test
    void fallsBackToRequestIpWhenTrustedHeadersMissing() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn(null);
        when(req.headers("CF-Connecting-IP")).thenReturn(null);
        when(req.ip()).thenReturn("127.0.0.1");

        assertEquals("127.0.0.1", ClientIpResolver.resolve(req, false));
    }

    @Test
    void returnsUnknownWhenNoIpAvailable() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn(" ");
        when(req.headers("CF-Connecting-IP")).thenReturn(null);
        when(req.ip()).thenReturn(null);

        assertEquals("unknown", ClientIpResolver.resolve(req, false));
    }

    @Test
    void rejectsMalformedHeaderValuesOnRender() {
        Request req = mock(Request.class);
        when(req.headers("True-Client-Ip")).thenReturn("not an ip, injected");
        when(req.headers("CF-Connecting-IP")).thenReturn(null);
        when(req.ip()).thenReturn("127.0.0.1");

        assertEquals("127.0.0.1", ClientIpResolver.resolve(req, true));
    }
}
