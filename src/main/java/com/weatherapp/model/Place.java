package com.weatherapp.model;

/**
 * One match for a place search: a town's name, its state or province (when
 * the country has them), its two-letter country code, and where it is.
 */
public class Place {

    private final String name;
    private final String state;
    private final String country;
    private final double lat;
    private final double lon;

    public Place(String name, String state, String country, double lat, double lon) {
        this.name = name;
        this.state = state;
        this.country = country;
        this.lat = lat;
        this.lon = lon;
    }

    public String getName() {
        return name;
    }

    public String getState() {
        return state;
    }

    public String getCountry() {
        return country;
    }

    public double getLat() {
        return lat;
    }

    public double getLon() {
        return lon;
    }
}
