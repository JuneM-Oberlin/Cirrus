package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.weatherapp.model.SixHourBlock;
import com.weatherapp.model.SixHourForecast;
import java.util.List;
import org.junit.jupiter.api.Test;

class SixHourParserTest {

    private final SixHourParser parser = new SixHourParser();

    // dt, temp_max, temp_min, condition id, icon, pop
    private static String entry(long dt, double max, double min, int id, String icon, double pop) {
        return """
                {"dt": %d,
                 "main": {"temp": %s, "temp_max": %s, "temp_min": %s},
                 "weather": [{"id": %d, "description": "desc %d", "icon": "%s"}],
                 "pop": %s}
                """.formatted(dt, max, max, min, id, id, icon, pop);
    }

    private static String forecast(int timezone, String... entries) {
        return """
                {"city": {"timezone": %d}, "list": [%s]}
                """.formatted(timezone, String.join(",", entries));
    }

    @Test
    void groupsThreeHourStepsIntoLocalSixHourBlocks() {
        // Denver is UTC-6, so 03:00Z is 9 p.m. the previous evening.
        String json = forecast(-21600,
                entry(1792638000L, 66, 64, 500, "10n", 0.2),   // Oct 21 21:00 local
                entry(1792648800L, 60, 58, 803, "04n", 0.0),   // Oct 22 00:00
                entry(1792659600L, 56, 55, 804, "04n", 0.0),   // Oct 22 03:00
                entry(1792670400L, 55, 54, 804, "04n", 0.1),   // Oct 22 06:00
                entry(1792681200L, 62, 60, 800, "01d", 0.4),   // Oct 22 09:00
                entry(1792692000L, 66, 65, 801, "02d", 0.0));  // Oct 22 12:00

        SixHourForecast result = parser.parse(json);
        List<SixHourBlock> blocks = result.getBlocks();

        assertEquals(-21600, result.getTimezoneOffset());
        assertEquals(4, blocks.size());

        assertEquals("2026-10-21", blocks.get(0).getDate());
        assertEquals("Wed", blocks.get(0).getDay());
        assertEquals(18, blocks.get(0).getStartHour());

        SixHourBlock earlyMorning = blocks.get(1);
        assertEquals("2026-10-22", earlyMorning.getDate());
        assertEquals("Thu", earlyMorning.getDay());
        assertEquals(0, earlyMorning.getStartHour());
        assertEquals(60.0, earlyMorning.getHigh());
        assertEquals(55.0, earlyMorning.getLow());

        SixHourBlock morning = blocks.get(2);
        assertEquals(6, morning.getStartHour());
        assertEquals(40, morning.getRainChance(), "rain chance is the block's highest pop");
        assertEquals(12, blocks.get(3).getStartHour());
    }

    @Test
    void showsTheMostNotableWeatherInEachBlock() {
        String json = forecast(0,
                entry(1792627200L, 70, 68, 801, "02d", 0.1),   // 00:00 few clouds
                entry(1792638000L, 69, 67, 211, "11d", 0.7));  // 03:00 thunderstorm

        SixHourBlock block = parser.parse(json).getBlocks().get(0);

        assertEquals(211, block.getConditionId());
        assertEquals("desc 211", block.getCondition());
        assertEquals(70, block.getRainChance());
    }

    @Test
    void marksABlockNightWhenMostOfItsStepsAreNight() {
        String json = forecast(0,
                entry(1792627200L, 50, 48, 800, "01n", 0.0),
                entry(1792638000L, 52, 49, 800, "01d", 0.0),
                entry(1792648800L, 55, 51, 803, "04d", 0.0),
                entry(1792659600L, 58, 54, 803, "04d", 0.0));

        List<SixHourBlock> blocks = parser.parse(json).getBlocks();

        assertEquals("01n", blocks.get(0).getWeatherCode(), "a tie in the 12 a.m. block is night");
        assertEquals("04d", blocks.get(1).getWeatherCode());
    }

    @Test
    void aTieInADaytimeBlockStaysDay() {
        // 06:00 is still dark, 09:00 is light: the 6 a.m. block shows the sun.
        String json = forecast(0,
                entry(1792648800L, 50, 48, 803, "04n", 0.0),
                entry(1792659600L, 55, 51, 803, "04d", 0.0));

        assertEquals("04d", parser.parse(json).getBlocks().get(0).getWeatherCode());
    }

    @Test
    void halfHourTimezonesStillLandInTheRightBlock() {
        // UTC+5:30: 00:00Z is 5:30 a.m. local, still the 12 a.m. block.
        String json = forecast(19800, entry(1792627200L, 80, 78, 800, "01n", 0.0));

        SixHourBlock block = parser.parse(json).getBlocks().get(0);

        assertEquals("2026-10-22", block.getDate());
        assertEquals(0, block.getStartHour());
    }

    @Test
    void returnsNoBlocksWhenListMissing() {
        SixHourForecast result = parser.parse("{\"city\": {\"timezone\": 3600}}");
        assertTrue(result.getBlocks().isEmpty());
        assertEquals(3600, result.getTimezoneOffset());
    }

    @Test
    void skipsEntriesWithoutTimestamps() {
        String json = forecast(0,
                "{\"main\": {\"temp\": 1}}",
                entry(1792627200L, 70, 68, 800, "01d", 0.0));

        assertEquals(1, parser.parse(json).getBlocks().size());
    }

    @Test
    void rejectsBlocksWithNoWeather() {
        String json = forecast(0, "{\"dt\": 1792627200, \"main\": {\"temp\": 1}}");
        assertThrows(RuntimeException.class, () -> parser.parse(json));
    }

    @Test
    void severityOrdersStormsAboveRainAboveClouds() {
        assertTrue(SixHourParser.severity(211) > SixHourParser.severity(601));
        assertTrue(SixHourParser.severity(601) > SixHourParser.severity(502));
        assertTrue(SixHourParser.severity(502) > SixHourParser.severity(500));
        assertTrue(SixHourParser.severity(741) > SixHourParser.severity(804));
        assertTrue(SixHourParser.severity(804) > SixHourParser.severity(801));
        assertTrue(SixHourParser.severity(801) > SixHourParser.severity(800));
    }
}
