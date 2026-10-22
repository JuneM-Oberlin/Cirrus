package com.weatherapp.service;

import com.weatherapp.model.GlobeCity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The fixed list of major cities the globe shows, grouped by region.
 * The page asks for one region at a time, so each region stays at or under
 * GlobeService's per-request fetch cap and one look costs at most a handful
 * of upstream calls.
 */
final class GlobeCities {

    private GlobeCities() {
    }

    static Map<String, List<GlobeCity>> byRegion() {
        Map<String, List<GlobeCity>> regions = new LinkedHashMap<>();

        add(regions, "north-america", "Seattle", 47.61, -122.33);
        add(regions, "north-america", "San Francisco", 37.77, -122.42);
        add(regions, "north-america", "Los Angeles", 34.05, -118.24);
        add(regions, "north-america", "Denver", 39.74, -104.99);
        add(regions, "north-america", "Dallas", 32.78, -96.80);
        add(regions, "north-america", "Chicago", 41.88, -87.63);
        add(regions, "north-america", "New York", 40.71, -74.01);
        add(regions, "north-america", "Mexico City", 19.43, -99.13);

        add(regions, "south-america", "Bogotá", 4.71, -74.07);
        add(regions, "south-america", "Lima", -12.05, -77.04);
        add(regions, "south-america", "São Paulo", -23.55, -46.63);
        add(regions, "south-america", "Rio de Janeiro", -22.91, -43.17);
        add(regions, "south-america", "Buenos Aires", -34.60, -58.38);
        add(regions, "south-america", "Santiago", -33.45, -70.67);

        add(regions, "europe", "London", 51.51, -0.13);
        add(regions, "europe", "Paris", 48.86, 2.35);
        add(regions, "europe", "Madrid", 40.42, -3.70);
        add(regions, "europe", "Rome", 41.90, 12.50);
        add(regions, "europe", "Berlin", 52.52, 13.40);
        add(regions, "europe", "Stockholm", 59.33, 18.07);
        add(regions, "europe", "Moscow", 55.76, 37.62);
        add(regions, "europe", "Istanbul", 41.01, 28.98);

        add(regions, "africa", "Cairo", 30.04, 31.24);
        add(regions, "africa", "Casablanca", 33.57, -7.59);
        add(regions, "africa", "Lagos", 6.52, 3.38);
        add(regions, "africa", "Kinshasa", -4.44, 15.27);
        add(regions, "africa", "Nairobi", -1.29, 36.82);
        add(regions, "africa", "Johannesburg", -26.20, 28.05);

        add(regions, "asia", "Tokyo", 35.68, 139.69);
        add(regions, "asia", "Seoul", 37.57, 126.98);
        add(regions, "asia", "Beijing", 39.90, 116.41);
        add(regions, "asia", "Shanghai", 31.23, 121.47);
        add(regions, "asia", "Hong Kong", 22.32, 114.17);
        add(regions, "asia", "Bangkok", 13.76, 100.50);
        add(regions, "asia", "Delhi", 28.61, 77.21);
        add(regions, "asia", "Dubai", 25.20, 55.27);

        add(regions, "oceania", "Sydney", -33.87, 151.21);
        add(regions, "oceania", "Melbourne", -37.81, 144.96);
        add(regions, "oceania", "Brisbane", -27.47, 153.03);
        add(regions, "oceania", "Perth", -31.95, 115.86);
        add(regions, "oceania", "Darwin", -12.46, 130.84);
        add(regions, "oceania", "Auckland", -36.85, 174.76);

        Map<String, List<GlobeCity>> frozen = new LinkedHashMap<>();
        regions.forEach((region, cities) -> frozen.put(region, Collections.unmodifiableList(cities)));
        return Collections.unmodifiableMap(frozen);
    }

    private static void add(Map<String, List<GlobeCity>> regions, String region,
            String name, double lat, double lon) {
        regions.computeIfAbsent(region, key -> new ArrayList<>())
                .add(new GlobeCity(name, region, lat, lon));
    }
}
