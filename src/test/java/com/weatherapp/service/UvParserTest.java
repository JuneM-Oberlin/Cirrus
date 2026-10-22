package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.weatherapp.model.UvIndex;
import org.junit.jupiter.api.Test;

class UvParserTest {

    private final UvParser parser = new UvParser();

    @Test
    void parsesValueDateAndCategory() {
        UvIndex uv = parser.parse("""
                {"lat": 39.74, "lon": -104.98, "date_iso": "2026-10-22T12:00:00Z",
                 "date": 1792670400, "value": 4.82}
                """);

        assertEquals(4.82, uv.getValue());
        assertEquals(1792670400L, uv.getDate());
        assertEquals("Moderate", uv.getCategory());
    }

    @Test
    void categoriesFollowTheRoundedWhoBands() {
        assertEquals("Low", UvParser.category(0.0));
        assertEquals("Low", UvParser.category(2.49));
        assertEquals("Moderate", UvParser.category(2.5));
        assertEquals("Moderate", UvParser.category(5.49));
        assertEquals("High", UvParser.category(5.5));
        assertEquals("High", UvParser.category(7.49));
        assertEquals("Very High", UvParser.category(7.5));
        assertEquals("Very High", UvParser.category(10.49));
        assertEquals("Extreme", UvParser.category(10.5));
        assertEquals("Extreme", UvParser.category(14.0));
    }

    @Test
    void missingDateDefaultsToZero() {
        assertEquals(0L, parser.parse("{\"value\": 1.0}").getDate());
    }

    @Test
    void rejectsMissingOrNegativeValues() {
        assertThrows(RuntimeException.class, () -> parser.parse("{\"date\": 1}"));
        assertThrows(RuntimeException.class, () -> parser.parse("{\"value\": -1.0}"));
    }
}
