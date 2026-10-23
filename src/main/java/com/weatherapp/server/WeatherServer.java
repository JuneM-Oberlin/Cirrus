package com.weatherapp.server;

import com.google.gson.Gson;
import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.GlobeRegion;
import com.weatherapp.model.Place;
import com.weatherapp.model.UvIndex;
import com.weatherapp.model.WeatherAlert;
import com.weatherapp.service.AlertService;
import com.weatherapp.service.GlobeService;
import com.weatherapp.service.NearbyService;
import com.weatherapp.service.NwsAlertClient;
import com.weatherapp.service.OpenWeatherClient;
import com.weatherapp.service.PlaceService;
import com.weatherapp.service.UvService;
import com.weatherapp.service.WeatherService;
import java.nio.file.Path;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import spark.Request;
import spark.Response;
import static spark.Spark.before;
import static spark.Spark.get;
import static spark.Spark.options;
import static spark.Spark.port;
import static spark.Spark.staticFiles;

public class WeatherServer {

    private static final int DEFAULT_PORT = 4567;

    static class ErrorResponse {

        String error;

        ErrorResponse(String message) {
            this.error = message;
        }
    }

    @FunctionalInterface
    interface CityFetcher {

        Object fetch(String city, String clientIp) throws Exception;
    }

    @FunctionalInterface
    interface PointFetcher {

        Object fetch(double lat, double lon, String clientIp) throws Exception;
    }

    static final int MAX_PLACE_QUERY_LENGTH = 100;

    public static void main(String[] args) {
        port(resolvePort(System.getenv("PORT")));
        staticFiles.externalLocation("public");
        staticFiles.registerMimeType("mp4", "video/mp4");
        enableCors(CorsConfig.fromEnvironment());

        RateLimiter rateLimiter = new RateLimiter(Clock.systemUTC());
        OpenWeatherClient openWeatherClient = new OpenWeatherClient();
        WeatherService service = new WeatherService(openWeatherClient);
        UvService uvService = new UvService(openWeatherClient);
        GlobeService globeService = new GlobeService(openWeatherClient);
        PlaceService placeService = new PlaceService(openWeatherClient);
        NearbyService nearbyService = new NearbyService(openWeatherClient);
        AlertService alertService = new AlertService(new NwsAlertClient());
        Gson gson = new Gson();

        get("/health", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\"}";
        });

        // These three take either ?city= or ?lat=&lon= (a place picked from
        // the search list or the globe, where a name could mean another town).
        get("/weather", (req, res) -> handleLookupRoute(req, res, gson, "City not found.",
                (c, ip) -> service.getWeather(c, rateLimitCheck(rateLimiter, ip)),
                (lat, lon, ip) -> service.getWeatherAt(lat, lon, rateLimitCheck(rateLimiter, ip))));

        get("/forecast", (req, res) -> handleLookupRoute(req, res, gson, "Forecast not found.",
                (c, ip) -> service.getForecast(c, rateLimitCheck(rateLimiter, ip)),
                (lat, lon, ip) -> service.getForecastAt(lat, lon, rateLimitCheck(rateLimiter, ip))));

        // Six-hour blocks come from the same cached forecast response, so this
        // route never makes an extra upstream call on top of /forecast.
        get("/sixhour", (req, res) -> handleLookupRoute(req, res, gson, "Forecast not found.",
                (c, ip) -> service.getSixHour(c, rateLimitCheck(rateLimiter, ip)),
                (lat, lon, ip) -> service.getSixHourAt(lat, lon, rateLimitCheck(rateLimiter, ip))));

        get("/places", (req, res) -> handlePlacesRoute(req, res, gson, rateLimiter, placeService));

        get("/nearby", (req, res) -> handleNearbyRoute(req, res, gson, rateLimiter, nearbyService));

        get("/alerts", (req, res) -> handleAlertsRoute(req, res, gson, rateLimiter, alertService));

        get("/uv", (req, res) -> handleUvRoute(req, res, gson, rateLimiter, uvService));

        get("/globe", (req, res) -> handleGlobeRoute(req, res, gson, rateLimiter, globeService));

        // Videos need Range support (iOS Safari refuses to play without it),
        // which Spark's static file handler doesn't provide.
        get("/stream/:file", (req, res) ->
                MediaStreamRoute.handle(req, res, Path.of("public", "media")));
    }

    static int resolvePort(String portStr) {
        if (portStr == null || portStr.isBlank()) {
            return DEFAULT_PORT;
        }
        try {
            int parsed = Integer.parseInt(portStr.trim());
            if (parsed < 1 || parsed > 65535) {
                System.err.println("Invalid PORT \"" + portStr + "\"; using default " + DEFAULT_PORT);
                return DEFAULT_PORT;
            }
            return parsed;
        } catch (NumberFormatException e) {
            System.err.println("Invalid PORT \"" + portStr + "\"; using default " + DEFAULT_PORT);
            return DEFAULT_PORT;
        }
    }

    static String badRequest(Response res, Gson gson, String message) {
        res.status(400);
        res.type("application/json");
        return gson.toJson(new ErrorResponse(message));
    }

    static Runnable rateLimitCheck(RateLimiter limiter, String clientIp) {
        return () -> {
            if (!limiter.isAllowed(clientIp)) {
                throw new RateLimitExceededException(RateLimitExceededException.DEFAULT_MESSAGE);
            }
        };
    }

    static Object handleCityRoute(
            Request req,
            Response res,
            Gson gson,
            String city,
            String notFoundMessage,
            CityFetcher fetcher) {

        res.type("application/json");
        try {
            return gson.toJson(fetcher.fetch(city, ClientIpResolver.resolve(req)));
        } catch (CityNotFoundException e) {
            res.status(404);
            return gson.toJson(new ErrorResponse(notFoundMessage));
        } catch (RateLimitExceededException e) {
            res.status(429);
            return gson.toJson(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            System.err.println("Route error: " + e.getMessage());
            res.status(500);
            return gson.toJson(new ErrorResponse("Something went wrong."));
        }
    }

    // /weather, /forecast, and /sixhour: a city name, or a position.
    static Object handleLookupRoute(
            Request req,
            Response res,
            Gson gson,
            String notFoundMessage,
            CityFetcher byCity,
            PointFetcher byPoint) {

        String city = req.queryParams("city");
        if (city != null && !city.isBlank()) {
            return handleCityRoute(req, res, gson, city, notFoundMessage, byCity);
        }
        String latStr = req.queryParams("lat");
        String lonStr = req.queryParams("lon");
        if ((latStr == null || latStr.isBlank()) && (lonStr == null || lonStr.isBlank())) {
            return badRequest(res, gson, "city parameter is required.");
        }
        String problem = coordinateProblem(latStr, lonStr);
        if (problem != null) {
            return badRequest(res, gson, problem);
        }
        double lat = Double.parseDouble(latStr.trim());
        double lon = Double.parseDouble(lonStr.trim());
        return handleCityRoute(req, res, gson, latStr + "," + lonStr, notFoundMessage,
                (label, ip) -> byPoint.fetch(lat, lon, ip));
    }

    // What is wrong with a lat/lon pair, or null when it is fine.
    static String coordinateProblem(String latStr, String lonStr) {
        if (latStr == null || latStr.isBlank() || lonStr == null || lonStr.isBlank()) {
            return "lat and lon parameters are required.";
        }
        double lat;
        double lon;
        try {
            lat = Double.parseDouble(latStr.trim());
            lon = Double.parseDouble(lonStr.trim());
        } catch (NumberFormatException e) {
            return "lat and lon must be numbers.";
        }
        if (Double.isNaN(lat) || Double.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return "lat and lon must be valid coordinates.";
        }
        return null;
    }

    static Object handlePlacesRoute(
            Request req,
            Response res,
            Gson gson,
            RateLimiter rateLimiter,
            PlaceService placeService) {

        res.type("application/json");
        String query = req.queryParams("q");
        if (query == null || query.isBlank()) {
            return badRequest(res, gson, "q parameter is required.");
        }
        if (query.length() > MAX_PLACE_QUERY_LENGTH) {
            return badRequest(res, gson, "q is too long.");
        }

        try {
            List<Place> places = placeService.getPlaces(query,
                    rateLimitCheck(rateLimiter, ClientIpResolver.resolve(req)));
            return gson.toJson(Map.of("places", places));
        } catch (RateLimitExceededException e) {
            res.status(429);
            return gson.toJson(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            System.err.println("Places route error: " + e.getMessage());
            res.status(503);
            return gson.toJson(new ErrorResponse("Could not search places."));
        }
    }

    static Object handleNearbyRoute(
            Request req,
            Response res,
            Gson gson,
            RateLimiter rateLimiter,
            NearbyService nearbyService) {

        res.type("application/json");
        String latStr = req.queryParams("lat");
        String lonStr = req.queryParams("lon");
        String problem = coordinateProblem(latStr, lonStr);
        if (problem != null) {
            return badRequest(res, gson, problem);
        }
        double lat = Double.parseDouble(latStr.trim());
        double lon = Double.parseDouble(lonStr.trim());

        try {
            List<GlobeMarker> towns = nearbyService.getNearby(lat, lon,
                    rateLimitCheck(rateLimiter, ClientIpResolver.resolve(req)));
            return gson.toJson(Map.of("towns", towns));
        } catch (RateLimitExceededException e) {
            res.status(429);
            return gson.toJson(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            System.err.println("Nearby route error: " + e.getMessage());
            res.status(503);
            return gson.toJson(new ErrorResponse("Could not load nearby towns."));
        }
    }

    static Object handleAlertsRoute(
            Request req,
            Response res,
            Gson gson,
            RateLimiter rateLimiter,
            AlertService alertService) {

        res.type("application/json");
        String latStr = req.queryParams("lat");
        String lonStr = req.queryParams("lon");
        if (latStr == null || latStr.isBlank() || lonStr == null || lonStr.isBlank()) {
            return badRequest(res, gson, "lat and lon parameters are required.");
        }
        double lat;
        double lon;
        try {
            lat = Double.parseDouble(latStr);
            lon = Double.parseDouble(lonStr);
        } catch (NumberFormatException e) {
            return badRequest(res, gson, "lat and lon must be numbers.");
        }

        Map<String, Object> payload = new HashMap<>();
        try {
            rateLimitCheck(rateLimiter, ClientIpResolver.resolve(req)).run();
            List<WeatherAlert> alerts = alertService.getAlerts(lat, lon);
            payload.put("alerts", alerts);
        } catch (RateLimitExceededException e) {
            res.status(429);
            return gson.toJson(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            System.err.println("Alerts route error: " + e.getMessage());
            res.status(503);
            payload.put("error", "Could not load weather alerts.");
            payload.put("alerts", List.of());
        }
        return gson.toJson(payload);
    }

    static Object handleUvRoute(
            Request req,
            Response res,
            Gson gson,
            RateLimiter rateLimiter,
            UvService uvService) {

        res.type("application/json");
        String latStr = req.queryParams("lat");
        String lonStr = req.queryParams("lon");
        if (latStr == null || latStr.isBlank() || lonStr == null || lonStr.isBlank()) {
            return badRequest(res, gson, "lat and lon parameters are required.");
        }
        double lat;
        double lon;
        try {
            lat = Double.parseDouble(latStr);
            lon = Double.parseDouble(lonStr);
        } catch (NumberFormatException e) {
            return badRequest(res, gson, "lat and lon must be numbers.");
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return badRequest(res, gson, "lat and lon must be valid coordinates.");
        }

        try {
            UvIndex uv = uvService.getUv(lat, lon,
                    rateLimitCheck(rateLimiter, ClientIpResolver.resolve(req)));
            return gson.toJson(uv);
        } catch (RateLimitExceededException e) {
            res.status(429);
            return gson.toJson(new ErrorResponse(e.getMessage()));
        } catch (Exception e) {
            System.err.println("UV route error: " + e.getMessage());
            res.status(503);
            return gson.toJson(new ErrorResponse("Could not load UV index."));
        }
    }

    static Object handleGlobeRoute(
            Request req,
            Response res,
            Gson gson,
            RateLimiter rateLimiter,
            GlobeService globeService) {

        res.type("application/json");
        String region = req.queryParams("region");
        if (region == null || region.isBlank()) {
            return badRequest(res, gson, "region parameter is required.");
        }
        if (!globeService.hasRegion(region)) {
            return badRequest(res, gson, "Unknown region.");
        }

        try {
            // Rate limiting happens per uncached city inside the service; a
            // tripped limit marks the remaining cities pending instead of failing.
            GlobeRegion result = globeService.getRegion(region,
                    rateLimitCheck(rateLimiter, ClientIpResolver.resolve(req)));
            return gson.toJson(result);
        } catch (Exception e) {
            System.err.println("Globe route error: " + e.getMessage());
            res.status(503);
            return gson.toJson(new ErrorResponse("Could not load the globe."));
        }
    }

    static void enableCors(CorsConfig corsConfig) {
        options("/*", (request, response) -> {
            corsConfig.applyPreflight(request, response);
            return "";
        });

        before((request, response) -> corsConfig.apply(request, response));
    }
}
