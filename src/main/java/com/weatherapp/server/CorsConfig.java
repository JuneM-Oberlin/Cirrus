package com.weatherapp.server;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import spark.Request;
import spark.Response;

final class CorsConfig {

    private static final String ALLOWED_ORIGINS_ENV = "ALLOWED_ORIGINS";
    private static final Set<String> DEFAULT_ORIGINS = Set.of(
            "https://junem-oberlin.github.io",
            "https://weatherapp-project-6rms.onrender.com",
            "http://localhost:4567",
            "http://127.0.0.1:4567"
    );

    private final Set<String> allowedOrigins;

    CorsConfig(Set<String> allowedOrigins) {
        this.allowedOrigins = Collections.unmodifiableSet(new LinkedHashSet<>(allowedOrigins));
    }

    static CorsConfig fromEnvironment() {
        String configured = System.getenv(ALLOWED_ORIGINS_ENV);
        if (configured == null || configured.isBlank()) {
            return new CorsConfig(DEFAULT_ORIGINS);
        }
        return new CorsConfig(parseOrigins(configured));
    }

    static Set<String> parseOrigins(String configured) {
        Set<String> origins = new LinkedHashSet<>(DEFAULT_ORIGINS);
        for (String origin : configured.split(",")) {
            String trimmed = origin.trim();
            if (!trimmed.isEmpty()) {
                origins.add(trimmed);
            }
        }
        return origins;
    }

    boolean isAllowed(String origin) {
        return origin != null && !origin.isBlank() && allowedOrigins.contains(origin);
    }

    Set<String> allowedOrigins() {
        return allowedOrigins;
    }

    void apply(Request request, Response response) {
        String origin = request.headers("Origin");
        if (!isAllowed(origin)) {
            return;
        }

        response.header("Access-Control-Allow-Origin", origin);
        response.header("Vary", "Origin");
    }

    void applyPreflight(Request request, Response response) {
        apply(request, response);
        if (!isAllowed(request.headers("Origin"))) {
            return;
        }

        response.header("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.header("Access-Control-Allow-Headers", "Content-Type");
        response.header("Access-Control-Max-Age", "86400");
    }
}
