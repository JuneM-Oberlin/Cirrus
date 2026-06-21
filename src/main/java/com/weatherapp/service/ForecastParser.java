package com.weatherapp.service;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.weatherapp.model.ForecastDay;
import static com.weatherapp.service.OpenWeatherJson.optionalDouble;
import static com.weatherapp.service.OpenWeatherJson.precipVolume;
import static com.weatherapp.service.OpenWeatherJson.requireInt;
import static com.weatherapp.service.OpenWeatherJson.requireString;

class ForecastParser {

    private static final String RESPONSE_TYPE = "forecast";

    List<ForecastDay> parseForecast(String json) {

        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonArray list = root.getAsJsonArray("list");
        // missing list is treated as empty forecast
        // malformed entries are skipped
        if (list == null) {
            return List.of();
        }

        Map<String, List<JsonObject>> dailyMap = new LinkedHashMap<>();

        for (int i = 0; i < list.size(); i++) {
            JsonElement element = list.get(i);
            if (element == null || element.isJsonNull()) {
                continue;
            }
            JsonObject entry = element.getAsJsonObject();
            if (entry == null || !entry.has("dt_txt")) {
                continue;
            }
            String dtTxt = entry.get("dt_txt").getAsString();
            if (dtTxt.length() < 10) {
                continue;
            }
            String date = dtTxt.substring(0, 10);

            dailyMap.putIfAbsent(date, new ArrayList<>());
            dailyMap.get(date).add(entry);
        }

        List<ForecastDay> days = new ArrayList<>();

        for (Map.Entry<String, List<JsonObject>> entry : dailyMap.entrySet()) {
            if (days.size() >= 5) {
                break;
            }
            days.add(buildDay(entry.getKey(), entry.getValue()));
        }

        return days;
    }

    private ForecastDay buildDay(String dateStr, List<JsonObject> dayEntries) {
        double maxTemp = Double.NEGATIVE_INFINITY;
        double minTemp = Double.POSITIVE_INFINITY;
        double precipitation = 0.0;

        JsonObject chosenEntry = dayEntries.get(0);
        for (JsonObject e : dayEntries) {
            JsonObject main = e.getAsJsonObject("main");
            if (main != null) {
                if (main.has("temp_max")) {
                    maxTemp = Math.max(maxTemp, main.get("temp_max").getAsDouble());
                }
                if (main.has("temp_min")) {
                    minTemp = Math.min(minTemp, main.get("temp_min").getAsDouble());
                }
            }

            precipitation += precipVolume(e, "rain", "3h")
                    + precipVolume(e, "snow", "3h");

            if (e.has("dt_txt") && e.get("dt_txt").getAsString().contains("12:00:00")) {
                chosenEntry = e;
            }
        }

        if (maxTemp == Double.NEGATIVE_INFINITY) {
            maxTemp = 0.0;
        }
        if (minTemp == Double.POSITIVE_INFINITY) {
            minTemp = 0.0;
        }

        JsonArray weatherArray = chosenEntry.getAsJsonArray("weather");
        if (weatherArray == null || weatherArray.isEmpty()) {
            throw new RuntimeException("Invalid forecast response: missing weather");
        }
        JsonElement weatherElement = weatherArray.get(0);
        if (weatherElement == null || weatherElement.isJsonNull()) {
            throw new RuntimeException("Invalid forecast response: missing weather");
        }
        JsonObject weather = weatherElement.getAsJsonObject();

        JsonObject wind = chosenEntry.getAsJsonObject("wind");
        double windSpeed = optionalDouble(wind, "speed", 0.0);

        int rainChance = 0;
        if (chosenEntry.has("pop")) {
            rainChance = (int) Math.round(
                    chosenEntry.get("pop").getAsDouble() * 100
            );
        }

        String condition = requireString(weather, "description", "description", RESPONSE_TYPE);
        String weatherCode = requireString(weather, "icon", "icon", RESPONSE_TYPE);
        int conditionId = requireInt(weather, "id", "id", RESPONSE_TYPE);

        String dayName = LocalDate.parse(dateStr)
                .getDayOfWeek()
                .getDisplayName(
                        TextStyle.SHORT,
                        Locale.ENGLISH
                );

        return new ForecastDay(
                dayName,
                maxTemp,
                minTemp,
                rainChance,
                condition,
                weatherCode,
                conditionId,
                windSpeed,
                precipitation
        );
    }
}
