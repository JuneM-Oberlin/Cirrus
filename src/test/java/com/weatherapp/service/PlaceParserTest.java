package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.weatherapp.model.Place;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlaceParserTest {

    private final PlaceParser parser = new PlaceParser();

    @Test
    void readsEachMatchWithStateAndCountry() {
        List<Place> places = parser.parse("""
                [
                  {"name": "Canton", "lat": 40.799, "lon": -81.378, "country": "US", "state": "Ohio"},
                  {"name": "Guangzhou City", "local_names": {"en": "Guangzhou", "zh": "广州市"},
                   "lat": 23.13, "lon": 113.26, "country": "CN", "state": "Guangdong Province"},
                  {"name": "San José", "lat": 9.93, "lon": -84.08, "country": "CR"}
                ]
                """);

        assertEquals(3, places.size());
        assertEquals("Canton", places.get(0).getName());
        assertEquals("Ohio", places.get(0).getState());
        assertEquals("US", places.get(0).getCountry());
        assertEquals(40.799, places.get(0).getLat());
        assertEquals("Guangzhou", places.get(1).getName(), "the English name wins");
        assertNull(places.get(2).getState(), "countries without states leave it empty");
    }

    @Test
    void keepsAPlaceListedTwiceOnlyOnce() {
        List<Place> places = parser.parse("""
                [
                  {"name": "Canton", "lat": 32.556, "lon": -95.863, "country": "US", "state": "Texas"},
                  {"name": "Canton", "lat": 32.5, "lon": -95.9, "country": "US", "state": "Texas"},
                  {"name": "Canton", "lat": 40.799, "lon": -81.378, "country": "US", "state": "Ohio"}
                ]
                """);

        assertEquals(2, places.size());
        assertEquals(32.556, places.get(0).getLat(), "the first listing is kept");
    }

    @Test
    void noMatchesIsAnEmptyList() {
        assertTrue(parser.parse("[]").isEmpty());
    }

    @Test
    void rejectsAnswersThatAreNotAList() {
        assertThrows(RuntimeException.class, () -> parser.parse("{\"cod\": 401}"));
    }
}
