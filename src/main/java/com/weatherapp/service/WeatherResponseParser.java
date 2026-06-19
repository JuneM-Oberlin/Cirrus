package com.weatherapp.service;

import com.weatherapp.model.WeatherData;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

class WeatherResponseParser {

    private static double precipVolume(JsonObject entry, String key, String... fields) {
        if (!entry.has(key)) {
            return 0.0;
        }
        JsonObject obj = entry.getAsJsonObject(key);
        if (obj == null) {
            return 0.0;
        }
        for (String field : fields) {
            if (obj.has(field)) {
                return obj.get(field).getAsDouble();
            }
        }
        return 0.0;
    }

    private static String requireString(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsString();
    }

    private static double requireDouble(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsDouble();
    }

    private static int requireInt(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsInt();
    }

    WeatherData parseWeather(String json) {

        JsonObject root = JsonParser.parseString(json).getAsJsonObject();

        JsonObject main = root.getAsJsonObject("main");
        if (main == null) {
            throw new RuntimeException("Invalid weather response: missing main");
        }

        JsonObject wind = root.getAsJsonObject("wind");

        JsonArray weatherArray = root.getAsJsonArray("weather");
        if (weatherArray == null || weatherArray.isEmpty()) {
            throw new RuntimeException("Invalid weather response: missing weather");
        }

        JsonElement weatherElement = weatherArray.get(0);
        if (weatherElement == null || weatherElement.isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing weather");
        }
        JsonObject weather = weatherElement.getAsJsonObject();

        String city = requireString(root, "name", "name");

        double temperature = requireDouble(main, "temp", "temp");
        double feelsLike = requireDouble(main, "feels_like", "feels_like");
        int humidity = requireInt(main, "humidity", "humidity");
        String condition = requireString(weather, "description", "description");

        double windSpeed = wind != null && wind.has("speed")
                ? wind.get("speed").getAsDouble()
                : 0.0;

        String weatherCode = requireString(weather, "icon", "icon");
        int conditionId = requireInt(weather, "id", "id");

        int windDeg = wind != null && wind.has("deg")
                ? wind.get("deg").getAsInt()
                : 0;

        int visibility = root.has("visibility")
                ? root.get("visibility").getAsInt()
                : 0;

        JsonObject clouds = root.getAsJsonObject("clouds");
        int cloudCover = clouds != null && clouds.has("all")
                ? clouds.get("all").getAsInt()
                : 0;

        JsonObject sys = root.getAsJsonObject("sys");
        long sunrise = sys != null && sys.has("sunrise")
                ? sys.get("sunrise").getAsLong()
                : 0L;
        long sunset = sys != null && sys.has("sunset")
                ? sys.get("sunset").getAsLong()
                : 0L;

        double pressure = requireDouble(main, "pressure", "pressure");
        double tempMin = requireDouble(main, "temp_min", "temp_min");
        double tempMax = requireDouble(main, "temp_max", "temp_max");

        double precipitation = precipVolume(root, "rain", "1h", "3h")
                + precipVolume(root, "snow", "1h", "3h");

        JsonObject coord = root.getAsJsonObject("coord");
        double lat = coord != null && coord.has("lat")
                ? coord.get("lat").getAsDouble()
                : 0.0;
        double lon = coord != null && coord.has("lon")
                ? coord.get("lon").getAsDouble()
                : 0.0;

        return new WeatherData(
                city,
                temperature,
                feelsLike,
                humidity,
                condition,
                windSpeed,
                weatherCode,
                conditionId,
                windDeg,
                visibility,
                cloudCover,
                sunrise,
                sunset,
                pressure,
                precipitation,
                tempMin,
                tempMax,
                lat,
                lon
        );
    }
}
