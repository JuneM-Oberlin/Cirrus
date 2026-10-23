package com.weatherapp.service;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.weatherapp.model.Place;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Reads OpenWeather's geocoding answer. Each match uses its English name
 * when there is one ("Guangzhou" rather than "Guangzhou City"), and a place
 * listed twice with the same name, state, and country is kept only once.
 */
class PlaceParser {

    List<Place> parse(String json) {
        JsonElement root = JsonParser.parseString(json);
        if (!root.isJsonArray()) {
            throw new RuntimeException("Invalid geocoding response: expected a list");
        }

        List<Place> places = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonElement element : root.getAsJsonArray()) {
            JsonObject match = element.getAsJsonObject();
            String name = englishName(match);
            String state = null;
            if (match.has("state") && !match.get("state").isJsonNull()) {
                state = match.get("state").getAsString();
            }
            String country = OpenWeatherJson.requireString(match, "country", "geocoding");
            double lat = OpenWeatherJson.requireDouble(match, "lat", "geocoding");
            double lon = OpenWeatherJson.requireDouble(match, "lon", "geocoding");

            String key = name + "|" + state + "|" + country;
            if (seen.add(key)) {
                places.add(new Place(name, state, country, lat, lon));
            }
        }
        return places;
    }

    private static String englishName(JsonObject match) {
        JsonObject localNames = null;
        if (match.has("local_names") && match.get("local_names").isJsonObject()) {
            localNames = match.getAsJsonObject("local_names");
        }
        if (localNames != null && localNames.has("en") && !localNames.get("en").isJsonNull()) {
            return localNames.get("en").getAsString();
        }
        return OpenWeatherJson.requireString(match, "name", "geocoding");
    }
}
