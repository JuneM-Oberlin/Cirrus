package com.weatherapp.service;

import com.weatherapp.model.WeatherData;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

class WeatherResponseParser {

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

        String city = OpenWeatherJson.requireString(root, "name", "weather");
        double temperature = OpenWeatherJson.requireDouble(main, "temp", "weather");
        double feelsLike = OpenWeatherJson.requireDouble(main, "feels_like", "weather");
        int humidity = OpenWeatherJson.requireInt(main, "humidity", "weather");
        String condition = OpenWeatherJson.requireString(weather, "description", "weather");
        double windSpeed = OpenWeatherJson.optionalDouble(wind, "speed", 0.0);
        String weatherCode = OpenWeatherJson.requireString(weather, "icon", "weather");
        int conditionId = OpenWeatherJson.requireInt(weather, "id", "weather");
        int windDeg = OpenWeatherJson.optionalInt(wind, "deg", 0);
        int visibility = OpenWeatherJson.optionalInt(root, "visibility", 0);

        JsonObject clouds = root.getAsJsonObject("clouds");
        int cloudCover = OpenWeatherJson.optionalInt(clouds, "all", 0);

        JsonObject sys = root.getAsJsonObject("sys");
        long sunrise = OpenWeatherJson.optionalLong(sys, "sunrise", 0L);
        long sunset = OpenWeatherJson.optionalLong(sys, "sunset", 0L);

        double pressure = OpenWeatherJson.requireDouble(main, "pressure", "weather");
        double tempMin = OpenWeatherJson.requireDouble(main, "temp_min", "weather");
        double tempMax = OpenWeatherJson.requireDouble(main, "temp_max", "weather");

        double precipitation = OpenWeatherJson.precipVolume(root, "rain", "1h", "3h")
                + OpenWeatherJson.precipVolume(root, "snow", "1h", "3h");

        JsonObject coord = root.getAsJsonObject("coord");
        double lat = OpenWeatherJson.optionalDouble(coord, "lat", 0.0);
        double lon = OpenWeatherJson.optionalDouble(coord, "lon", 0.0);

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
