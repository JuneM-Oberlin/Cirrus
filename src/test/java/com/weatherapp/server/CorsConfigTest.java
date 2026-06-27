package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Set;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class CorsConfigTest {

    @Test
    void allowsConfiguredOrigin() {
        CorsConfig config = new CorsConfig(Set.of("https://junem-oberlin.github.io"));
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        when(req.headers("Origin")).thenReturn("https://junem-oberlin.github.io");

        config.apply(req, res);

        verify(res).header("Access-Control-Allow-Origin", "https://junem-oberlin.github.io");
        verify(res).header("Vary", "Origin");
    }

    @Test
    void blocksUnknownOrigin() {
        CorsConfig config = new CorsConfig(Set.of("https://junem-oberlin.github.io"));
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        when(req.headers("Origin")).thenReturn("https://evil.example");

        config.apply(req, res);

        verify(res, never()).header(eq("Access-Control-Allow-Origin"), eq("https://evil.example"));
    }

    @Test
    void preflightSetsExplicitMethodsAndHeaders() {
        CorsConfig config = new CorsConfig(Set.of("https://junem-oberlin.github.io"));
        Request req = mock(Request.class);
        Response res = mock(Response.class);
        when(req.headers("Origin")).thenReturn("https://junem-oberlin.github.io");

        config.applyPreflight(req, res);

        verify(res).header("Access-Control-Allow-Origin", "https://junem-oberlin.github.io");
        verify(res).header("Access-Control-Allow-Methods", "GET, OPTIONS");
        verify(res).header("Access-Control-Allow-Headers", "Content-Type");
        verify(res).header("Access-Control-Max-Age", "86400");
    }

    @Test
    void defaultOriginsIncludeGitHubPages() {
        CorsConfig config = CorsConfig.fromEnvironment();
        assertTrue(config.isAllowed("https://junem-oberlin.github.io"));
        assertTrue(config.isAllowed("https://weatherapp-project-6rms.onrender.com"));
        assertTrue(config.isAllowed("http://localhost:4567"));
        assertFalse(config.isAllowed("https://evil.example"));
    }

    @Test
    void customOriginSetChecksMembership() {
        CorsConfig custom = new CorsConfig(Set.of(
                "https://a.example",
                "https://b.example"
        ));
        assertTrue(custom.isAllowed("https://a.example"));
        assertTrue(custom.isAllowed("https://b.example"));
        assertFalse(custom.isAllowed("https://c.example"));
    }

    @Test
    void configuredOriginsMergeWithDefaults() {
        CorsConfig merged = new CorsConfig(CorsConfig.parseOrigins("https://custom.example"));
        assertTrue(merged.isAllowed("https://custom.example"));
        assertTrue(merged.isAllowed("https://junem-oberlin.github.io"));
        assertTrue(merged.isAllowed("http://localhost:4567"));
        assertFalse(merged.isAllowed("https://evil.example"));
    }
}
