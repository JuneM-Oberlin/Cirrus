package com.weatherapp.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.weatherapp.model.WeatherAlert;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;

class AlertParserTest {

    private final AlertParser parser = new AlertParser();

    private static String featureJson(
            String event,
            String status,
            String messageType,
            String expiresIso,
            String areaDesc) {
        return """
                {
                  "type": "Feature",
                  "properties": {
                    "id": "test-id",
                    "event": "%s",
                    "status": "%s",
                    "messageType": "%s",
                    "expires": "%s",
                    "ends": "%s",
                    "areaDesc": "%s",
                    "description": "Test description",
                    "senderName": "NWS"
                  }
                }
                """.formatted(event, status, messageType, expiresIso, expiresIso, areaDesc);
    }

    private static String geoJson(String... features) {
        return """
                {
                  "type": "FeatureCollection",
                  "features": [%s]
                }
                """.formatted(String.join(",", features));
    }

    private static String futureIso() {
        return Instant.now().plus(6, ChronoUnit.HOURS).toString();
    }

    @Test
    void returnsEmptyListForBlankInput() {
        assertTrue(parser.parse("").isEmpty());
        assertTrue(parser.parse(null).isEmpty());
    }

    @Test
    void mapsWarningWatchAdvisoryAndStatementTiers() {
        String json = geoJson(
                featureJson("Severe Thunderstorm Warning", "Actual", "Alert", futureIso(), "County A"),
                featureJson("Flood Watch", "Actual", "Alert", futureIso(), "County B"),
                featureJson("Wind Advisory", "Actual", "Alert", futureIso(), "County C"),
                featureJson("Special Weather Statement", "Actual", "Alert", futureIso(), "County D")
        );

        List<WeatherAlert> alerts = parser.parse(json);
        assertEquals(4, alerts.size());
        assertEquals("warning", alerts.stream().filter(a -> a.getEvent().contains("Warning")).findFirst().orElseThrow().getTier());
        assertEquals("watch", alerts.stream().filter(a -> a.getEvent().contains("Watch")).findFirst().orElseThrow().getTier());
        assertEquals("advisory", alerts.stream().filter(a -> a.getEvent().contains("Advisory")).findFirst().orElseThrow().getTier());
        assertEquals("statement", alerts.stream().filter(a -> a.getEvent().contains("Statement")).findFirst().orElseThrow().getTier());
    }

    @Test
    void defaultsUnknownEventsToStatementTier() {
        String json = geoJson(featureJson("Hydrologic Outlook", "Actual", "Alert", futureIso(), "Basin X"));
        List<WeatherAlert> alerts = parser.parse(json);
        assertEquals(1, alerts.size());
        assertEquals("statement", alerts.get(0).getTier());
    }

    @Test
    void skipsNonActualAndCancelledAlerts() {
        String json = geoJson(
                featureJson("Severe Thunderstorm Warning", "Test", "Alert", futureIso(), "County A"),
                featureJson("Flood Watch", "Actual", "Cancel", futureIso(), "County B")
        );
        assertTrue(parser.parse(json).isEmpty());
    }

    @Test
    void sortsWarningsBeforeWatchesBeforeAdvisoriesBeforeStatements() {
        String json = geoJson(
                featureJson("Special Weather Statement", "Actual", "Alert", futureIso(), "County D"),
                featureJson("Severe Thunderstorm Warning", "Actual", "Alert", futureIso(), "County A"),
                featureJson("Wind Advisory", "Actual", "Alert", futureIso(), "County C"),
                featureJson("Flood Watch", "Actual", "Alert", futureIso(), "County B")
        );

        List<WeatherAlert> alerts = parser.parse(json);
        assertEquals(4, alerts.size());
        assertEquals("warning", alerts.get(0).getTier());
        assertEquals("watch", alerts.get(1).getTier());
        assertEquals("advisory", alerts.get(2).getTier());
        assertEquals("statement", alerts.get(3).getTier());
    }

    @Test
    void marksAutoPopForWarningsWatchesAndActionableStatements() {
        String json = geoJson(
                featureJson("Severe Thunderstorm Warning", "Actual", "Alert", futureIso(), "County A"),
                featureJson("Special Weather Statement", "Actual", "Alert", futureIso(), "County B")
        );
        List<WeatherAlert> alerts = parser.parse(json);
        assertTrue(alerts.stream().allMatch(WeatherAlert::isAutoPop));
    }

    @Test
    void excludesOutlookStatementsFromAutoPop() {
        String json = geoJson(
                featureJson("Hydrologic Outlook", "Actual", "Alert", futureIso(), "Basin X"),
                featureJson("Hazardous Weather Outlook", "Actual", "Alert", futureIso(), "County Y")
        );
        List<WeatherAlert> alerts = parser.parse(json);
        assertEquals(2, alerts.size());
        assertTrue(alerts.stream().noneMatch(WeatherAlert::isAutoPop));
    }

    @Test
    void advisoriesAreNotAutoPop() {
        String json = geoJson(featureJson("Wind Advisory", "Actual", "Alert", futureIso(), "County C"));
        List<WeatherAlert> alerts = parser.parse(json);
        assertEquals(1, alerts.size());
        assertEquals(false, alerts.get(0).isAutoPop());
    }
}
