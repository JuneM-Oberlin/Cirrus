
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import com.google.gson.Gson;

import static spark.Spark.before;
import static spark.Spark.get;
import static spark.Spark.options;
import static spark.Spark.port;
import static spark.Spark.staticFiles;

public class WeatherServer {

    // error response helper
    static class ErrorResponse {

        String error;

        ErrorResponse(String message) {
            this.error = message;
        }
    }

    // rate limiter
    static class RateLimiter {

        private static final int MAX_REQUESTS = 30;   // per window
        private static final int WINDOW_SECONDS = 60;  // 1 minute

        private static class Window {

            AtomicInteger count = new AtomicInteger(0);
            Instant resetAt = Instant.now().plusSeconds(WINDOW_SECONDS);
        }

        private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

        boolean isAllowed(String ip) {
            Window window = windows.compute(ip, (key, existing) -> {
                if (existing == null || Instant.now().isAfter(existing.resetAt)) {
                    return new Window(); // new window
                }
                return existing;
            });
            return window.count.incrementAndGet() <= MAX_REQUESTS;
        }
    }

    private static final RateLimiter rateLimiter = new RateLimiter();

    public static void main(String[] args) {

        //Port
        String portStr = System.getenv("PORT");

        if (portStr != null) {
            port(Integer.parseInt(portStr));
        } else {
            port(4567);
        }
        // serve static files
        staticFiles.externalLocation("public");

        // enable cors
        enableCORS();

        // create service + json
        WeatherService service = new WeatherService();

        Gson gson = new Gson();

        // warm-up endpoint no rate limiting, no external API calls
        get("/health", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\"}";
        });

        //GET /weather route
        get("/weather", (req, res) -> {

            //read city query param
            String city = req.queryParams("city");

            // rate limiting
            String ip = req.ip();
            if (!rateLimiter.isAllowed(ip)) {
                res.status(429);
                res.type("application/json");
                return gson.toJson(new ErrorResponse("Too many requests. Please wait a minute."));
            }

            //if missing
            if (city == null || city.isBlank()) {

                res.status(400);
                res.type("application/json");

                return gson.toJson(
                        new ErrorResponse(
                                "city parameter is required."
                        )
                );

            }
            try {

                //get weather
                WeatherData weather = service.getWeather(city);

                // return JSON
                res.type("application/json");

                return gson.toJson(weather);

            } catch (Exception e) {

                //if city not found
                res.status(404);
                res.type("application/json");

                return gson.toJson(
                        new ErrorResponse("City not found.")
                );
            }
        });

        //GET /forecast route
        get("/forecast", (req, res) -> {

            String city = req.queryParams("city");

            String ip = req.ip();
            if (!rateLimiter.isAllowed(ip)) {
                res.status(429);
                res.type("application/json");
                return gson.toJson(new ErrorResponse("Too many requests. Please wait a minute."));
            }

            if (city == null || city.isBlank()) {
                res.status(400);
                res.type("application/json");
                return gson.toJson(
                        new ErrorResponse("city parameter is required.")
                );
            }

            try {
                List<ForecastDay> forecast = service.getForecast(city);
                res.type("application/json");
                return gson.toJson(forecast);
            } catch (Exception e) {
                res.status(404);
                res.type("application/json");
                return gson.toJson(
                        new ErrorResponse("Forecast not found.")
                );
            }
        });
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
