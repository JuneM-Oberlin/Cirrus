
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import com.google.gson.Gson;

import spark.Request;
import spark.Response;
import static spark.Spark.before;
import static spark.Spark.get;
import static spark.Spark.options;
import static spark.Spark.port;
import static spark.Spark.staticFiles;

public class WeatherServer {

    private static final int DEFAULT_PORT = 4567;

    // error response helper
    static class ErrorResponse {

        String error;

        ErrorResponse(String message) {
            this.error = message;
        }
    }

    @FunctionalInterface
    private interface CityFetcher {

        Object fetch(String city) throws Exception;
    }

    // rate limiter
    static class RateLimiter {

        private static final int MAX_REQUESTS = 30;   // per window
        private static final int WINDOW_SECONDS = 60;  // 1 minute
        private static final int MAX_TRACKED_IPS = 500;

        private static class Window {

            AtomicInteger count = new AtomicInteger(0);
            Instant resetAt = Instant.now().plusSeconds(WINDOW_SECONDS);
        }

        private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

        boolean isAllowed(String ip) {
            Instant now = Instant.now();
            Window previous = windows.get(ip);
            boolean expired = previous != null && now.isAfter(previous.resetAt);

            Window window = windows.compute(ip, (key, existing) -> {
                if (existing == null || now.isAfter(existing.resetAt)) {
                    return new Window();
                }
                return existing;
            });

            if (expired || windows.size() > MAX_TRACKED_IPS) {
                pruneExpired();
            }

            return window.count.incrementAndGet() <= MAX_REQUESTS;
        }

        private void pruneExpired() {
            Instant now = Instant.now();
            windows.entrySet().removeIf(entry -> now.isAfter(entry.getValue().resetAt));
        }
    }

    private static final RateLimiter rateLimiter = new RateLimiter();

    public static void main(String[] args) {

        port(resolvePort(System.getenv("PORT")));

        // serve static files
        staticFiles.externalLocation("public");

        // enable cors
        enableCORS();

        // create service + json
        WeatherService service = new WeatherService();

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
            return handleCityRoute(req, res, gson, city, "City not found.",
                    service.isWeatherCached(city), service::getWeather);
        });

        get("/forecast", (req, res) -> {
            String city = req.queryParams("city");
            if (city == null || city.isBlank()) {
                return badRequest(res, gson, "city parameter is required.");
            }
            return handleCityRoute(req, res, gson, city, "Forecast not found.",
                    service.isForecastCached(city), service::getForecast);
        });
    }

    private static int resolvePort(String portStr) {
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

    private static String badRequest(Response res, Gson gson, String message) {
        res.status(400);
        res.type("application/json");
        return gson.toJson(new ErrorResponse(message));
    }

    private static Object handleCityRoute(
            Request req,
            Response res,
            Gson gson,
            String city,
            String notFoundMessage,
            boolean skipRateLimit,
            CityFetcher fetcher) {

        if (!skipRateLimit && !rateLimiter.isAllowed(req.ip())) {
            res.status(429);
            res.type("application/json");
            return gson.toJson(new ErrorResponse("Too many requests. Please wait a minute."));
        }

        res.type("application/json");
        try {
            return gson.toJson(fetcher.fetch(city));
        } catch (CityNotFoundException e) {
            res.status(404);
            return gson.toJson(new ErrorResponse(notFoundMessage));
        } catch (Exception e) {
            System.err.println("Route error: " + e.getMessage());
            res.status(500);
            return gson.toJson(new ErrorResponse("Something went wrong."));
        }
    }

    private static void enableCORS() {

        options("/*", (request, response) -> {

            String accessControlRequestHeaders
                    = request.headers(
                            "Access-Control-Request-Headers"
                    );

            if (accessControlRequestHeaders != null) {
                response.header(
                        "Access-Control-Allow-Headers",
                        accessControlRequestHeaders
                );
            }

            String accessControlRequestMethod
                    = request.headers(
                            "Access-Control-Request-Method"
                    );

            if (accessControlRequestMethod != null) {
                response.header(
                        "Access-Control-Allow-Methods",
                        accessControlRequestMethod
                );
            }

            return "OK";
        });

        before((request, response)
                -> response.header(
                        "Access-Control-Allow-Origin",
                        "*"
                )
        );

    }
}
