package com.weatherapp.server;

import com.google.gson.Gson;
import com.weatherapp.error.CityNotFoundException;
import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.service.OpenWeatherClient;
import com.weatherapp.service.WeatherService;
import java.time.Clock;
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

    public static void main(String[] args) {
        port(resolvePort(System.getenv("PORT")));
        staticFiles.externalLocation("public");
        enableCors(CorsConfig.fromEnvironment());

        RateLimiter rateLimiter = new RateLimiter(Clock.systemUTC());
        WeatherService service = new WeatherService(new OpenWeatherClient());
        Gson gson = new Gson();

        get("/health", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\"}";
        });

        get("/weather", (req, res) -> {
            String city = req.queryParams("city");
            if (city == null || city.isBlank()) {
                return badRequest(res, gson, "city parameter is required.");
            }
            return handleCityRoute(req, res, gson, city, "City not found.", (c, ip) ->
                    service.getWeather(c, rateLimitCheck(rateLimiter, ip)));
        });

        get("/forecast", (req, res) -> {
            String city = req.queryParams("city");
            if (city == null || city.isBlank()) {
                return badRequest(res, gson, "city parameter is required.");
            }
            return handleCityRoute(req, res, gson, city, "Forecast not found.", (c, ip) ->
                    service.getForecast(c, rateLimitCheck(rateLimiter, ip)));
        });
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

    static void enableCors(CorsConfig corsConfig) {
        options("/*", (request, response) -> {
            corsConfig.applyPreflight(request, response);
            return "";
        });

        before((request, response) -> corsConfig.apply(request, response));
    }
}
