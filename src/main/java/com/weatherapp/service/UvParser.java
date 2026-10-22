package com.weatherapp.service;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.weatherapp.model.UvIndex;

/** Reads OpenWeather's UV index response and adds the WHO category name. */
class UvParser {

    UvIndex parse(String json) {
        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        double value = OpenWeatherJson.requireDouble(root, "value", "UV");
        if (value < 0) {
            throw new RuntimeException("Invalid UV response: negative value");
        }
        long date = OpenWeatherJson.optionalLong(root, "date", 0L);
        return new UvIndex(value, category(value), date);
    }

    /**
     * WHO UV index bands, applied to the rounded value:
     * 0-2 Low, 3-5 Moderate, 6-7 High, 8-10 Very High, 11+ Extreme.
     */
    static String category(double value) {
        long rounded = Math.round(value);
        if (rounded <= 2) {
            return "Low";
        } else if (rounded <= 5) {
            return "Moderate";
        } else if (rounded <= 7) {
            return "High";
        } else if (rounded <= 10) {
            return "Very High";
        } else {
            return "Extreme";
        }
    }
}
