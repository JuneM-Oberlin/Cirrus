
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import io.github.cdimascio.dotenv.Dotenv;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class WeatherService {

    private static final Dotenv DOTENV = Dotenv.configure()
            .filename("touch.env")
            .ignoreIfMissing()
            .load();

    // shared client
    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient.Builder()
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(10))
            .build();

    // caching to make app faster
    private static class CacheEntry<T> {

        final T data;
        final Instant expiry;

        CacheEntry(T data, int ttlSeconds) {
            this.data = data;
            this.expiry = Instant.now().plusSeconds(ttlSeconds);
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiry);
        }
    }

    private static final int CACHE_TTL_SECONDS = 600; // 10 minutes
    private final ConcurrentHashMap<String, CacheEntry<WeatherData>> weatherCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CacheEntry<List<ForecastDay>>> forecastCache = new ConcurrentHashMap<>();

    private static String readResponseBody(Response response, String context) throws IOException {
        ResponseBody body = response.body();
        if (body == null) {
            throw new RuntimeException(context + ": empty response body");
        }
        return body.string();
    }

    public String getWeatherJSON(String city) {
        String apiKey = System.getenv("WEATHER_API_KEY");

        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = DOTENV.get("WEATHER_API_KEY");
        }

        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("WEATHER_API_KEY environment variable is not set. Add it to your shell environment or a .env file.");
        }
        // replace spaces with +
        String formattedCity = city.replace(" ", "+");

        //request URL
        String url
                = "https://api.openweathermap.org/data/2.5/weather"
                + "?q=" + formattedCity
                + "&appid=" + apiKey
                + "&units=imperial";

        // build request
        Request request = new Request.Builder()
                .url(url)
                .build();

        //send request and return response
        try (Response response = HTTP_CLIENT.newCall(request).execute()) {

            // if no failed response throw exception
            if (!response.isSuccessful()) {
                if (response.code() == 404) {
                    throw new CityNotFoundException(city);
                }
                throw new RuntimeException("HTTP Error: " + response.code());
            }

            return readResponseBody(response, "Weather API");

        } catch (IOException e) {

            //handle network exceptions
            throw new RuntimeException("Failed to fetch weather data.", e);
        }
    }

    // volume (mm) from a rain/snow object, taking the first field present
    private static double precipVolume(JsonObject entry, String key, String... fields) {
        if (!entry.has(key)) {
            return 0.0;
        }
        JsonObject obj = entry.getAsJsonObject(key);
        for (String field : fields) {
            if (obj.has(field)) {
                return obj.get(field).getAsDouble();
            }
        }
        return 0.0;
    }

    public WeatherData parseWeather(String json) {

        // parse root json object
        JsonObject root
                = JsonParser.parseString(json).getAsJsonObject();

        // extract nested objects
        JsonObject main = root.getAsJsonObject("main");
        if (main == null) {
            throw new RuntimeException("Invalid weather response: missing main");
        }

        JsonObject wind = root.getAsJsonObject("wind");

        JsonArray weatherArray = root.getAsJsonArray("weather");
        if (weatherArray == null || weatherArray.isEmpty()) {
            throw new RuntimeException("Invalid weather response: missing weather");
        }

        JsonObject weather = weatherArray.get(0).getAsJsonObject();

        String city
                = root.get("name").getAsString();

        Double temperature
                = main.get("temp").getAsDouble();

        Double feelsLike
                = main.get("feels_like").getAsDouble();

        int humidity
                = main.get("humidity").getAsInt();

        String condition
                = weather.get("description").getAsString();

        Double windSpeed = wind != null && wind.has("speed")
                ? wind.get("speed").getAsDouble()
                : 0.0;

        String weatherCode
                = weather.get("icon").getAsString();

        int conditionId
                = weather.get("id").getAsInt();

        int windDeg = wind != null && wind.has("deg")
                ? wind.get("deg").getAsInt()
                : 0;

        int visibility = root.has("visibility")
                ? root.get("visibility").getAsInt()
                : 0;

        JsonObject clouds = root.getAsJsonObject("clouds");
        int cloudCover = clouds != null
                ? clouds.get("all").getAsInt()
                : 0;

        JsonObject sys = root.getAsJsonObject("sys");
        long sunrise = sys != null && sys.has("sunrise")
                ? sys.get("sunrise").getAsLong()
                : 0L;
        long sunset = sys != null && sys.has("sunset")
                ? sys.get("sunset").getAsLong()
                : 0L;

        double pressure = main.get("pressure").getAsDouble();

        double tempMin = main.get("temp_min").getAsDouble();
        double tempMax = main.get("temp_max").getAsDouble();

        double precipitation = precipVolume(root, "rain", "1h", "3h")
                + precipVolume(root, "snow", "1h", "3h");

        JsonObject coord = root.getAsJsonObject("coord");
        double lat = coord != null && coord.has("lat")
                ? coord.get("lat").getAsDouble()
                : 0.0;
        double lon = coord != null && coord.has("lon")
                ? coord.get("lon").getAsDouble()
                : 0.0;

        return new WeatherData(
                city,
                temperature,
                feelsLike,
                humidity,
                condition,
                windSpeed,
                weatherCode,
                conditionId,
                windDeg,
                visibility,
                cloudCover,
                sunrise,
                sunset,
                pressure,
                precipitation,
                tempMin,
                tempMax,
                lat,
                lon
        );
    }

    public WeatherData getWeather(String city) {
        String key = normalizeCityKey(city);

        // return cached result if still fresh
        CacheEntry<WeatherData> cached = weatherCache.get(key);
        if (cached != null && !cached.isExpired()) {
            System.out.println("Cache hit: weather/" + key);
            return cached.data;
        }

        String json = getWeatherJSON(city);
        WeatherData data = parseWeather(json);

        // store in cache
        weatherCache.put(key, new CacheEntry<>(data, CACHE_TTL_SECONDS));
        return data;
    }

    public boolean isWeatherCached(String city) {
        return isCached(weatherCache, city);
    }

    public boolean isForecastCached(String city) {
        return isCached(forecastCache, city);
    }

    private <T> boolean isCached(ConcurrentHashMap<String, CacheEntry<T>> cache, String city) {
        CacheEntry<T> cached = cache.get(normalizeCityKey(city));
        return cached != null && !cached.isExpired();
    }

    private static String normalizeCityKey(String city) {
        return city.toLowerCase().trim();
    }

    public List<ForecastDay> getForecast(String city) throws Exception {
        String key = normalizeCityKey(city);

        CacheEntry<List<ForecastDay>> cached = forecastCache.get(key);
        if (cached != null && !cached.isExpired()) {
            System.out.println("Cache hit: forecast/" + key);
            return cached.data;
        }

        String apiKey = System.getenv("WEATHER_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = DOTENV.get("WEATHER_API_KEY");
        }
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("WEATHER_API_KEY is not set.");
        }

        String url = "https://api.openweathermap.org/data/2.5/forecast"
                + "?q=" + city.replace(" ", "+")
                + "&appid=" + apiKey
                + "&units=imperial"
                + "&cnt=40";

        Request request = new Request.Builder().url(url).build();

        try (Response response = HTTP_CLIENT.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                if (response.code() == 404) {
                    throw new CityNotFoundException(city);
                }
                throw new RuntimeException("Forecast error: " + response.code());
            }
            List<ForecastDay> data = parseForecast(readResponseBody(response, "Forecast API"));
            forecastCache.put(key, new CacheEntry<>(data, CACHE_TTL_SECONDS));
            return data;
        }
    }

    private List<ForecastDay> parseForecast(String json) {

        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonArray list = root.getAsJsonArray("list");

// group by date
        Map<String, List<JsonObject>> dailyMap = new LinkedHashMap<>();

        for (int i = 0; i < list.size(); i++) {
            JsonObject entry = list.get(i).getAsJsonObject();
            String dtTxt = entry.get("dt_txt").getAsString();
            String date = dtTxt.substring(0, 10);

            dailyMap.putIfAbsent(date, new ArrayList<>());
            dailyMap.get(date).add(entry);
        }

        List<ForecastDay> days = new ArrayList<>();

        for (Map.Entry<String, List<JsonObject>> entry : dailyMap.entrySet()) {
            if (days.size() >= 5) {
                break;
            }
            days.add(buildDay(entry.getKey(), entry.getValue()));
        }

        return days;
    }

    // reduce one date's 3-hour entries to a single forecast day
    private ForecastDay buildDay(String dateStr, List<JsonObject> dayEntries) {
        double maxTemp = Double.NEGATIVE_INFINITY;
        double minTemp = Double.POSITIVE_INFINITY;
        double precipitation = 0.0;

        // default to first entry, but prefer noon for visuals
        JsonObject chosenEntry = dayEntries.get(0);
        for (JsonObject e : dayEntries) {
            JsonObject main = e.getAsJsonObject("main");
            if (main != null) {
                if (main.has("temp_max")) {
                    maxTemp = Math.max(maxTemp, main.get("temp_max").getAsDouble());
                }
                if (main.has("temp_min")) {
                    minTemp = Math.min(minTemp, main.get("temp_min").getAsDouble());
                }
            }

            // sum rain + snow volume (mm per 3h window) for the daily total
            precipitation += precipVolume(e, "rain", "3h")
                    + precipVolume(e, "snow", "3h");

            if (e.has("dt_txt") && e.get("dt_txt").getAsString().contains("12:00:00")) {
                chosenEntry = e;
            }
        }

        if (maxTemp == Double.NEGATIVE_INFINITY) {
            maxTemp = 0.0;
        }
        if (minTemp == Double.POSITIVE_INFINITY) {
            minTemp = 0.0;
        }

        JsonArray weatherArray = chosenEntry.getAsJsonArray("weather");
        if (weatherArray == null || weatherArray.isEmpty()) {
            throw new RuntimeException("Invalid forecast response: missing weather");
        }
        JsonObject weather = weatherArray.get(0).getAsJsonObject();

        // wind from the noon entry, consistent with condition/icon
        JsonObject wind = chosenEntry.getAsJsonObject("wind");
        double windSpeed = wind != null && wind.has("speed")
                ? wind.get("speed").getAsDouble()
                : 0.0;

        int rainChance = 0;
        if (chosenEntry.has("pop")) {
            rainChance = (int) Math.round(
                    chosenEntry.get("pop").getAsDouble() * 100
            );
        }

        String dayName = java.time.LocalDate.parse(dateStr)
                .getDayOfWeek()
                .getDisplayName(
                        java.time.format.TextStyle.SHORT,
                        java.util.Locale.ENGLISH
                );

        return new ForecastDay(
                dayName,
                maxTemp,
                minTemp,
                rainChance,
                weather.get("description").getAsString(),
                weather.get("icon").getAsString(),
                weather.get("id").getAsInt(),
                windSpeed,
                precipitation
        );
    }
}
