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
