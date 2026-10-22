package com.weatherapp.model;

/** One fixed city on the globe: its display name, region, and position. */
public class GlobeCity {

    private final String name;
    private final String region;
    private final double lat;
    private final double lon;

    public GlobeCity(String name, String region, double lat, double lon) {
        this.name = name;
        this.region = region;
        this.lat = lat;
        this.lon = lon;
    }

    public String getName() {
        return name;
    }

    public String getRegion() {
        return region;
    }

    public double getLat() {
        return lat;
    }

    public double getLon() {
        return lon;
    }
}
