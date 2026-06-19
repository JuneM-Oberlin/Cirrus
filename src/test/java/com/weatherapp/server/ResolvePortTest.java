package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ResolvePortTest {

    @Test
    void usesDefaultWhenMissing() {
        assertEquals(4567, WeatherServer.resolvePort(null));
        assertEquals(4567, WeatherServer.resolvePort(" "));
    }

    @Test
    void parsesValidPort() {
        assertEquals(8080, WeatherServer.resolvePort("8080"));
        assertEquals(1, WeatherServer.resolvePort("1"));
        assertEquals(65535, WeatherServer.resolvePort("65535"));
    }

    @Test
    void rejectsInvalidPort() {
        assertEquals(4567, WeatherServer.resolvePort("abc"));
        assertEquals(4567, WeatherServer.resolvePort("0"));
        assertEquals(4567, WeatherServer.resolvePort("70000"));
    }
}
