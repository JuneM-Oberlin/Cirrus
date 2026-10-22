package com.weatherapp.model;

import java.util.List;

/** The /globe response: one region's city markers. */
public class GlobeRegion {

    private String region;
    private List<GlobeMarker> cities;

    public GlobeRegion(String region, List<GlobeMarker> cities) {
        this.region = region;
        this.cities = cities;
    }

    public String getRegion() {
        return region;
    }

    public List<GlobeMarker> getCities() {
        return cities;
    }
}
