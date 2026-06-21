package com.weatherapp.service;

import com.weatherapp.model.WeatherData;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import static com.weatherapp.service.OpenWeatherJson.optionalDouble;
import static com.weatherapp.service.OpenWeatherJson.optionalInt;
import static com.weatherapp.service.OpenWeatherJson.optionalLong;
import static com.weatherapp.service.OpenWeatherJson.precipVolume;
import static com.weatherapp.service.OpenWeatherJson.requireDouble;
import static com.weatherapp.service.OpenWeatherJson.requireInt;
import static com.weatherapp.service.OpenWeatherJson.requireString;

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

        String city = requireString(root, "name", "name");
        double temperature = requireDouble(main, "temp", "temp");
        double feelsLike = requireDouble(main, "feels_like", "feels_like");
        int humidity = requireInt(main, "humidity", "humidity");
        String condition = requireString(weather, "description", "description");
        double windSpeed = optionalDouble(wind, "speed", 0.0);
        String weatherCode = requireString(weather, "icon", "icon");
        int conditionId = requireInt(weather, "id", "id");
        int windDeg = optionalInt(wind, "deg", 0);
        int visibility = optionalInt(root, "visibility", 0);

        JsonObject clouds = root.getAsJsonObject("clouds");
        int cloudCover = optionalInt(clouds, "all", 0);

        JsonObject sys = root.getAsJsonObject("sys");
        long sunrise = optionalLong(sys, "sunrise", 0L);
        long sunset = optionalLong(sys, "sunset", 0L);

        double pressure = requireDouble(main, "pressure", "pressure");
        double tempMin = requireDouble(main, "temp_min", "temp_min");
        double tempMax = requireDouble(main, "temp_max", "temp_max");

        double precipitation = precipVolume(root, "rain", "1h", "3h")
                + precipVolume(root, "snow", "1h", "3h");

        JsonObject coord = root.getAsJsonObject("coord");
        double lat = optionalDouble(coord, "lat", 0.0);
        double lon = optionalDouble(coord, "lon", 0.0);

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
