package com.weatherapp.service;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.weatherapp.model.SixHourBlock;
import com.weatherapp.model.SixHourForecast;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Groups OpenWeather's 3-hour forecast steps into six-hour blocks in the
 * city's local time (12 a.m., 6 a.m., 12 p.m., 6 p.m.). This reuses the
 * same upstream response as the daily forecast, so it costs no extra call.
 */
class SixHourParser {

    private static final int BLOCK_HOURS = 6;

    SixHourForecast parse(String json) {
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonObject city = root.getAsJsonObject("city");
        int timezoneOffset = OpenWeatherJson.optionalInt(city, "timezone", 0);

        JsonArray list = root.getAsJsonArray("list");
        if (list == null) {
            return new SixHourForecast(timezoneOffset, List.of());
        }

        // key "2026-10-23|6" -> the 3-hour entries that start inside that block
        Map<String, List<JsonObject>> groups = new LinkedHashMap<>();
        Map<String, LocalDateTime> groupStarts = new LinkedHashMap<>();

        for (int i = 0; i < list.size(); i++) {
            JsonElement element = list.get(i);
            if (element == null || !element.isJsonObject()) {
                continue;
            }
            JsonObject entry = element.getAsJsonObject();
            if (!entry.has("dt")) {
                continue;
            }
            long localSeconds = entry.get("dt").getAsLong() + timezoneOffset;
            LocalDateTime local = LocalDateTime.ofEpochSecond(localSeconds, 0, ZoneOffset.UTC);
            int startHour = (local.getHour() / BLOCK_HOURS) * BLOCK_HOURS;
            String key = local.toLocalDate() + "|" + startHour;

            if (!groups.containsKey(key)) {
                groups.put(key, new ArrayList<>());
                groupStarts.put(key, local.withHour(startHour).withMinute(0).withSecond(0));
            }
            groups.get(key).add(entry);
        }

        List<SixHourBlock> blocks = new ArrayList<>();
        for (Map.Entry<String, List<JsonObject>> group : groups.entrySet()) {
            blocks.add(buildBlock(groupStarts.get(group.getKey()), group.getValue()));
        }
        return new SixHourForecast(timezoneOffset, blocks);
    }

    private SixHourBlock buildBlock(LocalDateTime start, List<JsonObject> entries) {
        double high = Double.NEGATIVE_INFINITY;
        double low = Double.POSITIVE_INFINITY;
        double maxPop = 0.0;
        int nightEntries = 0;
        JsonObject representative = null;
        int representativeRank = -1;

        for (JsonObject entry : entries) {
            JsonObject main = entry.getAsJsonObject("main");
            if (main != null) {
                double temp = OpenWeatherJson.optionalDouble(main, "temp", 0.0);
                high = Math.max(high, OpenWeatherJson.optionalDouble(main, "temp_max", temp));
                low = Math.min(low, OpenWeatherJson.optionalDouble(main, "temp_min", temp));
            }
            maxPop = Math.max(maxPop, OpenWeatherJson.optionalDouble(entry, "pop", 0.0));

            JsonObject weather = firstWeather(entry);
            if (weather == null) {
                continue;
            }
            String icon = OpenWeatherJson.requireString(weather, "icon", "forecast");
            if (icon.endsWith("n")) {
                nightEntries++;
            }
            int rank = severity(OpenWeatherJson.requireInt(weather, "id", "forecast"));
            if (rank > representativeRank) {
                representativeRank = rank;
                representative = weather;
            }
        }

        if (representative == null) {
            throw new RuntimeException("Invalid forecast response: missing weather");
        }
        if (high == Double.NEGATIVE_INFINITY) {
            high = 0.0;
        }
        if (low == Double.POSITIVE_INFINITY) {
            low = 0.0;
        }

        // Night when most steps are night; a tie follows the block itself
        // (the 12 a.m. and 6 p.m. blocks are night, the other two are day).
        boolean night = nightEntries * 2 > entries.size();
        if (nightEntries * 2 == entries.size()) {
            night = start.getHour() == 0 || start.getHour() == 18;
        }
        String icon = OpenWeatherJson.requireString(representative, "icon", "forecast");
        String weatherCode = icon;
        if (icon.length() > 1) {
            String base = icon.substring(0, icon.length() - 1);
            if (night) {
                weatherCode = base + "n";
            } else {
                weatherCode = base + "d";
            }
        }

        String dayName = start.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
        return new SixHourBlock(
                dayName,
                start.toLocalDate().toString(),
                start.getHour(),
                high,
                low,
                (int) Math.round(maxPop * 100),
                OpenWeatherJson.requireString(representative, "description", "forecast"),
                weatherCode,
                OpenWeatherJson.requireInt(representative, "id", "forecast"));
    }

    private static JsonObject firstWeather(JsonObject entry) {
        JsonArray weatherArray = entry.getAsJsonArray("weather");
        if (weatherArray == null || weatherArray.isEmpty()) {
            return null;
        }
        JsonElement first = weatherArray.get(0);
        if (first == null || !first.isJsonObject()) {
            return null;
        }
        return first.getAsJsonObject();
    }

    /**
     * Ranks OpenWeather condition ids so a block shows its most notable
     * weather: storms, then snow, rain, drizzle, haze/fog, clouds, clear.
     * Within a group a higher id means heavier weather (or more cloud).
     */
    static int severity(int conditionId) {
        int group = conditionId / 100;
        int rank;
        if (group == 2) {
            rank = 6;
        } else if (group == 6) {
            rank = 5;
        } else if (group == 5) {
            rank = 4;
        } else if (group == 3) {
            rank = 3;
        } else if (group == 7) {
            rank = 2;
        } else if (conditionId == 800) {
            rank = 0;
        } else {
            rank = 1;
        }
        return rank * 1000 + conditionId % 100;
    }
}
