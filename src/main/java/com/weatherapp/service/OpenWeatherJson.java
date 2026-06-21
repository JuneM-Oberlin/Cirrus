package com.weatherapp.service;

import com.google.gson.JsonObject;

final class OpenWeatherJson {

    private OpenWeatherJson() {
    }

    static double precipVolume(JsonObject entry, String key, String... fields) {
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

    static String requireString(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsString();
    }

    static String requireString(JsonObject obj, String field, String context, String responseType) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid " + responseType + " response: missing " + context);
        }
        return obj.get(field).getAsString();
    }

    static double requireDouble(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsDouble();
    }

    static double requireDouble(JsonObject obj, String field, String context, String responseType) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid " + responseType + " response: missing " + context);
        }
        return obj.get(field).getAsDouble();
    }

    static int requireInt(JsonObject obj, String field, String context) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid weather response: missing " + context);
        }
        return obj.get(field).getAsInt();
    }

    static int requireInt(JsonObject obj, String field, String context, String responseType) {
        if (!obj.has(field) || obj.get(field).isJsonNull()) {
            throw new RuntimeException("Invalid " + responseType + " response: missing " + context);
        }
        return obj.get(field).getAsInt();
    }

    static double optionalDouble(JsonObject obj, String field, double defaultValue) {
        if (obj == null || !obj.has(field) || obj.get(field).isJsonNull()) {
            return defaultValue;
        }
        return obj.get(field).getAsDouble();
    }

    static int optionalInt(JsonObject obj, String field, int defaultValue) {
        if (obj == null || !obj.has(field) || obj.get(field).isJsonNull()) {
            return defaultValue;
        }
        return obj.get(field).getAsInt();
    }

    static long optionalLong(JsonObject obj, String field, long defaultValue) {
        if (obj == null || !obj.has(field) || obj.get(field).isJsonNull()) {
            return defaultValue;
        }
        return obj.get(field).getAsLong();
    }
}
