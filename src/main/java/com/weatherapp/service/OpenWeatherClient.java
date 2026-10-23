package com.weatherapp.service;

import com.weatherapp.error.CityNotFoundException;
import io.github.cdimascio.dotenv.Dotenv;
import java.io.IOException;
import java.time.Duration;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class OpenWeatherClient {

    private static final Dotenv DOTENV = Dotenv.configure()
            .filename("touch.env")
            .ignoreIfMissing()
            .load();

    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(10))
            .build();

    private final String apiKey;

    public OpenWeatherClient() {
        this.apiKey = resolveApiKey();
    }

    private static String resolveApiKey() {
        String apiKey = System.getenv("WEATHER_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = DOTENV.get("WEATHER_API_KEY");
        }
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("WEATHER_API_KEY is not set.");
        }
        return apiKey;
    }

    private static String readResponseBody(Response response, String context) throws IOException {
        ResponseBody body = response.body();
        if (body == null) {
            throw new RuntimeException(context + ": empty response body");
        }
        return body.string();
    }

    public String getWeatherJSON(String city) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/weather")
                .addQueryParameter("q", city)
                .addQueryParameter("appid", apiKey)
                .addQueryParameter("units", "imperial")
                .build();

        return fetchJson(url, city, "Weather API");
    }

    /** Current weather at a point; the globe uses this for its fixed city list. */
    public String getWeatherByCoordsJSON(double lat, double lon) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/weather")
                .addQueryParameter("lat", String.format("%.4f", lat))
                .addQueryParameter("lon", String.format("%.4f", lon))
                .addQueryParameter("appid", apiKey)
                .addQueryParameter("units", "imperial")
                .build();

        return fetchJson(url, lat + "," + lon, "Weather API");
    }

    /** The 3-hour forecast at a point, for places picked from a list or a map. */
    public String getForecastByCoordsJSON(double lat, double lon) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/forecast")
                .addQueryParameter("lat", String.format("%.4f", lat))
                .addQueryParameter("lon", String.format("%.4f", lon))
                .addQueryParameter("appid", apiKey)
                .addQueryParameter("units", "imperial")
                .addQueryParameter("cnt", "40")
                .build();

        return fetchJson(url, lat + "," + lon, "Forecast API");
    }

    /**
     * Places whose name matches the search, with their state and country, so
     * the page can ask "which Canton?". OpenWeather's geocoding answers with
     * an empty list, not a 404, when nothing matches.
     */
    public String getPlacesJSON(String query) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("geo/1.0/direct")
                .addQueryParameter("q", query)
                .addQueryParameter("limit", "5")
                .addQueryParameter("appid", apiKey)
                .build();

        return fetchJson(url, query, "Geocoding API");
    }

    /** The towns nearest a point, each with its current weather, in one call. */
    public String getNearbyJSON(double lat, double lon, int count) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/find")
                .addQueryParameter("lat", String.format("%.4f", lat))
                .addQueryParameter("lon", String.format("%.4f", lon))
                .addQueryParameter("cnt", String.valueOf(count))
                .addQueryParameter("appid", apiKey)
                .addQueryParameter("units", "imperial")
                .build();

        return fetchJson(url, lat + "," + lon, "Nearby API");
    }

    public String getForecastJSON(String city) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/forecast")
                .addQueryParameter("q", city)
                .addQueryParameter("appid", apiKey)
                .addQueryParameter("units", "imperial")
                .addQueryParameter("cnt", "40")
                .build();

        return fetchJson(url, city, "Forecast API");
    }

    /**
     * Today's UV index for a point. This is OpenWeather's older UV endpoint:
     * it still answers on the free plan but is deprecated, so callers must
     * treat a failure as "UV unavailable" rather than an error page.
     */
    public String getUvJSON(double lat, double lon) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.openweathermap.org")
                .addPathSegments("data/2.5/uvi")
                .addQueryParameter("lat", String.format("%.4f", lat))
                .addQueryParameter("lon", String.format("%.4f", lon))
                .addQueryParameter("appid", apiKey)
                .build();

        Request request = new Request.Builder()
                .url(url)
                .build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new RuntimeException("UV API error: " + response.code());
            }
            return readResponseBody(response, "UV API");
        } catch (IOException e) {
            throw new RuntimeException("Failed to fetch UV data.", e);
        }
    }

    private String fetchJson(HttpUrl url, String city, String context) {
        Request request = new Request.Builder()
                .url(url)
                .build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                if (response.code() == 404) {
                    throw new CityNotFoundException(city);
                }
                throw new RuntimeException(context + " error: " + response.code());
            }
            return readResponseBody(response, context);
        } catch (IOException e) {
            throw new RuntimeException("Failed to fetch " + context.toLowerCase() + " data.", e);
        }
    }
}
