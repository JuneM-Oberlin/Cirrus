package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.weatherapp.model.WeatherData;
import org.junit.jupiter.api.Test;

class WeatherResponseParserTest {

    private final WeatherResponseParser parser = new WeatherResponseParser();

    private static final String VALID_JSON = """
            {
              "name": "London",
              "main": {
                "temp": 70.0,
                "feels_like": 68.0,
                "humidity": 50,
                "pressure": 1013.0,
                "temp_min": 65.0,
                "temp_max": 75.0
              },
              "weather": [{"description": "clear sky", "icon": "01d", "id": 800}],
              "wind": {"speed": 5.0, "deg": 180},
              "coord": {"lat": 51.5, "lon": -0.1},
              "timezone": 3600,
              "sys": {"sunrise": 100, "sunset": 200},
              "clouds": {"all": 25},
              "visibility": 10000
            }
            """;

    @Test
    void parsesValidWeatherJson() {
        WeatherData data = parser.parseWeather(VALID_JSON);

        assertEquals("London", data.getCity());
        assertEquals(70.0, data.getTemperature());
        assertEquals(68.0, data.getFeelsLike());
        assertEquals(50, data.getHumidity());
        assertEquals("clear sky", data.getCondition());
        assertEquals(5.0, data.getWindSpeed());
        assertEquals(180, data.getWindDeg());
        assertEquals(25, data.getCloudCover());
        assertEquals(3600, data.getTimezoneOffset());
    }

    @Test
    void throwsWhenMainMissing() {
        assertThrows(RuntimeException.class, () -> parser.parseWeather(
                """
                {
                  "name": "London",
                  "weather": [{"description": "clear", "icon": "01d", "id": 800}]
                }
                """
        ));
    }

    @Test
    void throwsWhenWeatherMissing() {
        assertThrows(RuntimeException.class, () -> parser.parseWeather(
                """
                {
                  "name": "London",
                  "main": {
                    "temp": 70.0,
                    "feels_like": 68.0,
                    "humidity": 50,
                    "pressure": 1013.0,
                    "temp_min": 65.0,
                    "temp_max": 75.0
                  }
                }
                """
        ));
    }

    @Test
    void handlesMissingOptionalSections() {
        WeatherData data = parser.parseWeather(
                """
                {
                  "name": "London",
                  "main": {
                    "temp": 70.0,
                    "feels_like": 68.0,
                    "humidity": 50,
                    "pressure": 1013.0,
                    "temp_min": 65.0,
                    "temp_max": 75.0
                  },
                  "weather": [{"description": "clear", "icon": "01d", "id": 800}]
                }
                """
        );

        assertEquals(0.0, data.getWindSpeed());
        assertEquals(0, data.getWindDeg());
        assertEquals(0.0, data.getLat());
        assertEquals(0.0, data.getLon());
        assertEquals(0L, data.getSunrise());
        assertEquals(0L, data.getSunset());
    }
}
