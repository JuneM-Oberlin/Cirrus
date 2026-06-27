package com.weatherapp.service;

import com.weatherapp.model.WeatherAlert;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Turns the NWS GeoJSON {@code /alerts/active} payload into a clean, sorted
 * list of {@link WeatherAlert}. Drops test/exercise messages, cancellations,
 * expired entries, and duplicate event+area pairs (NWS sends "Update" copies).
 */
class AlertParser {

    List<WeatherAlert> parse(String json) {
        List<WeatherAlert> alerts = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return alerts;
        }

        JsonElement rootElement = JsonParser.parseString(json);
        if (!rootElement.isJsonObject()) {
            return alerts;
        }
        JsonArray features = rootElement.getAsJsonObject().getAsJsonArray("features");
        if (features == null) {
            return alerts;
        }

        long now = Instant.now().getEpochSecond();
        Set<String> seen = new HashSet<>();

        for (JsonElement feature : features) {
            if (feature == null || !feature.isJsonObject()) {
                continue;
            }
            JsonObject props = feature.getAsJsonObject().getAsJsonObject("properties");
            if (props == null) {
                continue;
            }

            String status = optString(props, "status");
            if (status != null && !status.equalsIgnoreCase("Actual")) {
                continue;
            }
            String messageType = optString(props, "messageType");
            if (messageType != null && messageType.equalsIgnoreCase("Cancel")) {
                continue;
            }

            String event = optString(props, "event");
            if (event == null || event.isBlank()) {
                continue;
            }

            long expires = epoch(optString(props, "expires"));
            long ends = epoch(optString(props, "ends"));
            long effectiveEnd = ends > 0 ? ends : expires;
            if (effectiveEnd > 0 && effectiveEnd < now) {
                continue;
            }

            String areaDesc = optString(props, "areaDesc");
            String dedupeKey = event + "|" + (areaDesc == null ? "" : areaDesc);
            if (!seen.add(dedupeKey)) {
                continue;
            }

            String id = optString(props, "id");
            if (id == null || id.isBlank()) {
                id = event + ":" + expires;
            }

            String tier = tierOf(event);

            alerts.add(new WeatherAlert(
                    id,
                    event,
                    tier,
                    rankOf(tier),
                    optString(props, "severity"),
                    optString(props, "headline"),
                    optString(props, "description"),
                    optString(props, "instruction"),
                    optString(props, "senderName"),
                    areaDesc,
                    epoch(optString(props, "effective")),
                    expires,
                    ends,
                    optString(props, "urgency"),
                    optString(props, "certainty")));
        }

        alerts.sort(Comparator
                .comparingInt(WeatherAlert::getTierRank).reversed()
                .thenComparingLong(WeatherAlert::getExpires));
        return alerts;
    }

    private static String tierOf(String event) {
        String e = event.toLowerCase();
        if (e.contains("warning")) {
            return "warning";
        }
        if (e.contains("watch")) {
            return "watch";
        }
        if (e.contains("advisory")) {
            return "advisory";
        }
        return "statement";
    }

    private static int rankOf(String tier) {
        switch (tier) {
            case "warning":
                return 3;
            case "watch":
                return 2;
            case "advisory":
                return 1;
            default:
                return 0;
        }
    }

    private static long epoch(String iso) {
        if (iso == null || iso.isBlank()) {
            return 0L;
        }
        try {
            return OffsetDateTime.parse(iso).toEpochSecond();
        } catch (RuntimeException e) {
            return 0L;
        }
    }

    private static String optString(JsonObject obj, String key) {
        JsonElement el = obj.get(key);
        if (el == null || el.isJsonNull()) {
            return null;
        }
        return el.getAsString();
    }
}
