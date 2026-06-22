package com.weatherapp.service;

import com.weatherapp.model.ForecastDay;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

class ForecastParser {

    List<ForecastDay> parseForecast(String json) {

        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonArray list = root.getAsJsonArray("list");
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

            precipitation += OpenWeatherJson.precipVolume(e, "rain", "3h")
                    + OpenWeatherJson.precipVolume(e, "snow", "3h");

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
        double windSpeed = OpenWeatherJson.optionalDouble(wind, "speed", 0.0);

        int rainChance = 0;
        if (chosenEntry.has("pop")) {
            rainChance = (int) Math.round(
                    chosenEntry.get("pop").getAsDouble() * 100
            );
        }

        String condition = OpenWeatherJson.requireString(weather, "description", "forecast");
        String weatherCode = OpenWeatherJson.requireString(weather, "icon", "forecast");
        int conditionId = OpenWeatherJson.requireInt(weather, "id", "forecast");

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
