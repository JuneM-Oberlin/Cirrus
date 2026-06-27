package com.weatherapp.service;

import com.weatherapp.model.WeatherAlert;
import java.util.List;

/**
 * Caches active alerts by rounded coordinate for a short window so repeated
 * searches of the same city don't hammer NWS. NWS alert data changes on the
 * order of minutes, so a 5-minute TTL is plenty fresh.
 */
public class AlertService {

    private static final int CACHE_TTL_SECONDS = 300;

    private final WeatherCache<List<WeatherAlert>> cache;
    private final NwsAlertClient client;
    private final AlertParser parser;

    public AlertService(NwsAlertClient client) {
        this.client = client;
        this.cache = new WeatherCache<>(CACHE_TTL_SECONDS);
        this.parser = new AlertParser();
    }

    public List<WeatherAlert> getAlerts(double lat, double lon) {
        String key = String.format("%.3f,%.3f", lat, lon);

        List<WeatherAlert> cached = cache.get(key);
        if (cached != null) {
            return cached;
        }

        String json = client.getAlertsJSON(lat, lon);
        List<WeatherAlert> alerts = parser.parse(json);
        cache.put(key, alerts);
        return alerts;
    }
}
