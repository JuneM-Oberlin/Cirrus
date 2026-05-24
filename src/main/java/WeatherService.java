import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import io.github.cdimascio.dotenv.Dotenv;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class WeatherService {

    private static final Dotenv DOTENV = Dotenv.configure()
            .filename("touch.env")
            .ignoreIfMissing()
            .load();

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

        //http client
        OkHttpClient client = new OkHttpClient();

        // build request
        Request request = new Request.Builder()
                .url(url)
                .build();

        //send request and return response
        try (Response response = client.newCall(request).execute()) {

            // if no failed response throw exception
            if (!response.isSuccessful()) {
                throw new RuntimeException("HTTP Error: " + response.code());
            }

            return response.body().string();

        } catch (IOException e) {

            //handle network exceptions
            throw new RuntimeException("Failed to fetch weather data.", e);
        }
    }

    public WeatherData parseWeather(String json) {

        // parse root json object
        JsonObject root
                = JsonParser.parseString(json).getAsJsonObject();

        // extract nested objects
        JsonObject main
                = root.getAsJsonObject("main");

        JsonObject wind
                = root.getAsJsonObject("wind");

        JsonArray weatherArray
                = root.getAsJsonArray("weather");

        JsonObject weather
                = weatherArray.get(0).getAsJsonObject();

        ///extract fields

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

        Double windSpeed
                = wind.get("speed").getAsDouble();

        String weatherCode
                = weather.get("icon").getAsString();

        int conditionId
                = weather.get("id").getAsInt();

        int windDeg
                = wind.get("deg").getAsInt();

        return new WeatherData(
                city,
                temperature,
                feelsLike,
                humidity,
                condition,
                windSpeed,
                weatherCode,
                conditionId,
                windDeg
        );
    }

    public WeatherData getWeather(String city) {
        String json = getWeatherJSON(city);

        return parseWeather(json);
    }

    public List<ForecastDay> getForecast(String city) throws Exception {

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

        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder().url(url).build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new RuntimeException("Forecast error: " + response.code());
            }
            return parseForecast(response.body().string());
        }
    }

    private List<ForecastDay> parseForecast(String json) {

        JsonObject root = JsonParser.parseString(json).getAsJsonObject();
        JsonArray list = root.getAsJsonArray("list");

        // group by date, prefer noon reading
        Map<String, JsonObject> dailyMap = new LinkedHashMap<>();

        for (int i = 0; i < list.size(); i++) {
            JsonObject entry = list.get(i).getAsJsonObject();
            String dtTxt = entry.get("dt_txt").getAsString();
            String date = dtTxt.substring(0, 10);
            String hour = dtTxt.substring(11, 13);

            if (!dailyMap.containsKey(date) || hour.equals("12")) {
                dailyMap.put(date, entry);
            }
        }

        List<ForecastDay> days = new ArrayList<>();

        for (Map.Entry<String, JsonObject> entry : dailyMap.entrySet()) {
            if (days.size() >= 5) {
                break;
            }

            JsonObject e = entry.getValue();
            JsonObject main = e.getAsJsonObject("main");
            JsonObject weather = e.getAsJsonArray("weather")
                    .get(0).getAsJsonObject();

            int rainChance = 0;
            if (e.has("pop")) {
                rainChance = (int) Math.round(
                        e.get("pop").getAsDouble() * 100
                );
            }

            java.time.LocalDate date = java.time.LocalDate.parse(entry.getKey());
            String dayName = date.getDayOfWeek()
                    .getDisplayName(
                            java.time.format.TextStyle.SHORT,
                            java.util.Locale.ENGLISH
                    );

            days.add(new ForecastDay(
                    dayName,
                    main.get("temp_max").getAsDouble(),
                    main.get("temp_min").getAsDouble(),
                    rainChance,
                    weather.get("description").getAsString(),
                    weather.get("icon").getAsString(),
                    weather.get("id").getAsInt()
            ));
        }

        return days;
    }
}
