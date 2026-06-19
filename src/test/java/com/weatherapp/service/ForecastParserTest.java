package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.weatherapp.model.ForecastDay;
import java.util.List;
import org.junit.jupiter.api.Test;

class ForecastParserTest {

    private final ForecastParser parser = new ForecastParser();

    private static final String ENTRY_TEMPLATE = """
            {
              "dt_txt": "%s",
              "main": {"temp_max": 70.0, "temp_min": 55.0},
              "weather": [{"description": "cloudy", "icon": "03d", "id": 803}],
              "wind": {"speed": 8.0},
              "pop": 0.25
            }
            """;

    @Test
    void returnsEmptyListWhenListMissing() {
        List<ForecastDay> days = parser.parseForecast("{\"cod\":\"200\"}");
        assertTrue(days.isEmpty());
    }

    @Test
    void skipsEntriesMissingDtTxt() {
        String json = """
                {
                  "list": [
                    {"main": {"temp_max": 70.0, "temp_min": 55.0}},
                    %s
                  ]
                }
                """.formatted(String.format(ENTRY_TEMPLATE, "2026-06-17 12:00:00"));

        List<ForecastDay> days = parser.parseForecast(json);
        assertEquals(1, days.size());
    }

    @Test
    void parsesForecastDays() {
        String json = """
                {
                  "list": [
                    %s,
                    %s
                  ]
                }
                """.formatted(
                String.format(ENTRY_TEMPLATE, "2026-06-17 12:00:00"),
                String.format(ENTRY_TEMPLATE, "2026-06-18 12:00:00")
        );

        List<ForecastDay> days = parser.parseForecast(json);
        assertEquals(2, days.size());
        assertEquals(70.0, days.get(0).getHigh());
        assertEquals(55.0, days.get(0).getLow());
        assertEquals(25, days.get(0).getRainChance());
    }

    @Test
    void throwsWhenWeatherMissingOnValidEntry() {
        String json = """
                {
                  "list": [
                    {
                      "dt_txt": "2026-06-17 12:00:00",
                      "main": {"temp_max": 70.0, "temp_min": 55.0}
                    }
                  ]
                }
                """;

        assertThrows(RuntimeException.class, () -> parser.parseForecast(json));
    }
}
