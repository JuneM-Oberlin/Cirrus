package com.weatherapp.service;

import com.weatherapp.error.CityNotFoundException;
import io.github.cdimascio.dotenv.Dotenv;
import java.io.IOException;
import java.time.Duration;
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

    private static String readResponseBody(Response response, String context) throws IOException {
        ResponseBody body = response.body();
        if (body == null) {
            throw new RuntimeException(context + ": empty response body");
        }
        return body.string();
    }

    private String resolveApiKey() {
        String apiKey = System.getenv("WEATHER_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = DOTENV.get("WEATHER_API_KEY");
        }
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("WEATHER_API_KEY is not set.");
        }
        return apiKey;
    }

    public String getWeatherJSON(String city) {
        String apiKey = resolveApiKey();
        String formattedCity = city.replace(" ", "+");

        String url = "https://api.openweathermap.org/data/2.5/weather"
                + "?q=" + formattedCity
                + "&appid=" + apiKey
                + "&units=imperial";

        Request request = new Request.Builder()
                .url(url)
                .build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {

            if (!response.isSuccessful()) {
                if (response.code() == 404) {
                    throw new CityNotFoundException(city);
                }
                throw new RuntimeException("HTTP Error: " + response.code());
            }

            return readResponseBody(response, "Weather API");

        } catch (IOException e) {

            throw new RuntimeException("Failed to fetch weather data.", e);
        }
    }

    public String getForecastJSON(String city) throws IOException {
        String apiKey = resolveApiKey();

        String url = "https://api.openweathermap.org/data/2.5/forecast"
                + "?q=" + city.replace(" ", "+")
                + "&appid=" + apiKey
                + "&units=imperial"
                + "&cnt=40";

        Request request = new Request.Builder().url(url).build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                if (response.code() == 404) {
                    throw new CityNotFoundException(city);
                }
                throw new RuntimeException("Forecast error: " + response.code());
            }
            return readResponseBody(response, "Forecast API");
        }
    }
}

