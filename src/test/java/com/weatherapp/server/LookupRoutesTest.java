package com.weatherapp.server;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.google.gson.Gson;
import com.weatherapp.error.RateLimitExceededException;
import com.weatherapp.model.GlobeCity;
import com.weatherapp.model.GlobeMarker;
import com.weatherapp.model.Place;
import com.weatherapp.model.WeatherData;
import com.weatherapp.service.NearbyService;
import com.weatherapp.service.PlaceService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import spark.Request;
import spark.Response;

class LookupRoutesTest {

    private Request request(Map<String, String> params) {
        Request req = mock(Request.class);
        when(req.queryParams(anyString())).thenAnswer((call) -> params.get(call.getArgument(0, String.class)));
        when(req.ip()).thenReturn("127.0.0.1");
        return req;
    }

    // ---------- /weather, /forecast, /sixhour ----------

    @Test
    void aCityNameUsesTheCityLookup() {
        Response res = mock(Response.class);
        Object result = WeatherServer.handleLookupRoute(request(Map.of("city", "Canton,OH,US")), res, new Gson(),
                "City not found.",
                (city, ip) -> Map.of("by", "city", "city", city),
                (lat, lon, ip) -> Map.of("by", "point"));

        assertTrue(result.toString().contains("\"by\":\"city\""));
        assertTrue(result.toString().contains("Canton,OH,US"));
    }

    @Test
    void latAndLonUseThePointLookup() {
        Response res = mock(Response.class);
        Object result = WeatherServer.handleLookupRoute(request(Map.of("lat", "40.799", "lon", "-81.378")), res,
                new Gson(), "City not found.",
                (city, ip) -> Map.of("by", "city"),
                (lat, lon, ip) -> Map.of("by", "point", "lat", lat, "lon", lon));

        assertTrue(result.toString().contains("\"by\":\"point\""));
        assertTrue(result.toString().contains("40.799"));
    }

    @Test
    void neitherCityNorPositionIsABadRequest() {
        Response res = mock(Response.class);
        Object result = WeatherServer.handleLookupRoute(request(Map.of()), res, new Gson(), "City not found.",
                (city, ip) -> Map.of(), (lat, lon, ip) -> Map.of());

        verify(res).status(400);
        assertTrue(result.toString().contains("city parameter is required."));
    }

    @Test
    void badPositionsAreBadRequests() {
        for (Map<String, String> params : List.of(
                Map.of("lat", "40.8"),
                Map.of("lat", "north", "lon", "-81"),
                Map.of("lat", "95", "lon", "-81"),
                Map.of("lat", "NaN", "lon", "-81"))) {
            Response res = mock(Response.class);
            WeatherServer.handleLookupRoute(request(params), res, new Gson(), "City not found.",
                    (city, ip) -> Map.of(), (lat, lon, ip) -> Map.of());
            verify(res).status(400);
        }
    }

    // ---------- /places ----------

    @Test
    void placesListsTheMatches() {
        PlaceService places = mock(PlaceService.class);
        when(places.getPlaces(eq("Canton"), any(Runnable.class))).thenReturn(List.of(
                new Place("Canton", "Ohio", "US", 40.799, -81.378),
                new Place("Guangzhou", "Guangdong Province", "CN", 23.13, 113.26)));

        Object result = WeatherServer.handlePlacesRoute(request(Map.of("q", "Canton")), mock(Response.class),
                new Gson(), mock(RateLimiter.class), places);

        assertTrue(result.toString().startsWith("{\"places\":["));
        assertTrue(result.toString().contains("\"state\":\"Ohio\""));
        assertTrue(result.toString().contains("\"name\":\"Guangzhou\""));
    }

    @Test
    void placesNeedsAShortSearch() {
        PlaceService places = mock(PlaceService.class);
        Response missing = mock(Response.class);
        WeatherServer.handlePlacesRoute(request(Map.of()), missing, new Gson(), mock(RateLimiter.class), places);
        verify(missing).status(400);

        Response tooLong = mock(Response.class);
        WeatherServer.handlePlacesRoute(request(Map.of("q", "x".repeat(WeatherServer.MAX_PLACE_QUERY_LENGTH + 1))),
                tooLong, new Gson(), mock(RateLimiter.class), places);
        verify(tooLong).status(400);
        verify(places, never()).getPlaces(anyString(), any(Runnable.class));
    }

    @Test
    void placesReportsTheRateLimit() {
        PlaceService places = mock(PlaceService.class);
        when(places.getPlaces(anyString(), any(Runnable.class)))
                .thenThrow(new RateLimitExceededException(RateLimitExceededException.DEFAULT_MESSAGE));
        Response res = mock(Response.class);

        WeatherServer.handlePlacesRoute(request(Map.of("q", "Canton")), res, new Gson(), mock(RateLimiter.class), places);

        verify(res).status(429);
    }

    // ---------- /nearby ----------

    @Test
    void nearbyListsTownsWithWeather() {
        NearbyService nearby = mock(NearbyService.class);
        WeatherData weather = new WeatherData("Oberlin", 42.7, 40.0, 80, "mist", 3.0, "50n", 701,
                200, 0, 90, 0, 0, 1015, 0, 40, 44, 41.294, -82.217, 0);
        when(nearby.getNearby(eq(41.3), eq(-82.2), any(Runnable.class)))
                .thenReturn(List.of(GlobeMarker.withWeather(new GlobeCity("Oberlin", "nearby", 41.294, -82.217), weather)));

        Object result = WeatherServer.handleNearbyRoute(request(Map.of("lat", "41.3", "lon", "-82.2")),
                mock(Response.class), new Gson(), mock(RateLimiter.class), nearby);

        assertTrue(result.toString().startsWith("{\"towns\":["));
        assertTrue(result.toString().contains("\"name\":\"Oberlin\""));
        assertTrue(result.toString().contains("\"temperature\":42.7"));
    }

    @Test
    void nearbyNeedsAPosition() {
        NearbyService nearby = mock(NearbyService.class);
        Response res = mock(Response.class);

        WeatherServer.handleNearbyRoute(request(Map.of("lat", "41.3")), res, new Gson(), mock(RateLimiter.class), nearby);

        verify(res).status(400);
        verify(nearby, never()).getNearby(anyDouble(), anyDouble(), any(Runnable.class));
    }

    @Test
    void nearbyFailuresAre503() {
        NearbyService nearby = mock(NearbyService.class);
        when(nearby.getNearby(anyDouble(), anyDouble(), any(Runnable.class))).thenThrow(new RuntimeException("down"));
        Response res = mock(Response.class);

        Object result = WeatherServer.handleNearbyRoute(request(Map.of("lat", "41.3", "lon", "-82.2")), res,
                new Gson(), mock(RateLimiter.class), nearby);

        verify(res).status(503);
        assertTrue(result.toString().contains("Could not load nearby towns."));
    }
}
