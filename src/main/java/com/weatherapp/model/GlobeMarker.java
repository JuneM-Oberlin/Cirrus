package com.weatherapp.model;

/**
 * A city marker on the globe. When {@code pending} is true the weather has
 * not been fetched yet (per-request cap or rate limit) and only the name
 * and position are filled in; the page asks again a little later.
 */
public class GlobeMarker {

    private String name;
    private double lat;
    private double lon;
    private boolean pending;
    private Double temperature;
    private Integer conditionId;
    private String weatherCode;
    private String condition;

    public static GlobeMarker pending(GlobeCity city) {
        GlobeMarker marker = new GlobeMarker();
        marker.name = city.getName();
        marker.lat = city.getLat();
        marker.lon = city.getLon();
        marker.pending = true;
        return marker;
    }

    public static GlobeMarker withWeather(GlobeCity city, WeatherData weather) {
        GlobeMarker marker = new GlobeMarker();
        marker.name = city.getName();
        marker.lat = city.getLat();
        marker.lon = city.getLon();
        marker.pending = false;
        marker.temperature = weather.getTemperature();
        marker.conditionId = weather.getConditionId();
        marker.weatherCode = weather.getWeatherCode();
        marker.condition = weather.getCondition();
        return marker;
    }

    public String getName() {
        return name;
    }

    public double getLat() {
        return lat;
    }

    public double getLon() {
        return lon;
    }

    public boolean isPending() {
        return pending;
    }

    public Double getTemperature() {
        return temperature;
    }

    public Integer getConditionId() {
        return conditionId;
    }

    public String getWeatherCode() {
        return weatherCode;
    }

    public String getCondition() {
        return condition;
    }
}
