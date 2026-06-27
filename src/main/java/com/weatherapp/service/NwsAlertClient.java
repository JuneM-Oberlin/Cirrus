package com.weatherapp.service;

import java.io.IOException;
import java.time.Duration;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * Fetches active severe-weather alerts from the US National Weather Service.
 * No API key required, but NWS mandates a descriptive User-Agent header.
 * Points outside NWS coverage (non-US) return a 4xx, which we surface as
 * {@code null} so callers treat it as "no alerts" rather than an error.
 */
public class NwsAlertClient {

    private static final String USER_AGENT =
            "CirrusWeather/1.0 (https://github.com/JuneM-Oberlin/Cirrus)";

    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(10))
            .build();

    public String getAlertsJSON(double lat, double lon) {
        HttpUrl url = new HttpUrl.Builder()
                .scheme("https")
                .host("api.weather.gov")
                .addPathSegments("alerts/active")
                .addQueryParameter("point", String.format("%.4f,%.4f", lat, lon))
                .build();

        Request request = new Request.Builder()
                .url(url)
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/geo+json")
                .build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                return null;
            }
            ResponseBody body = response.body();
            return body == null ? null : body.string();
        } catch (IOException e) {
            throw new RuntimeException("NWS alerts request failed", e);
        }
    }
}
