
import java.io.IOException;

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

    public WeatherData parseWeather (String json) {
        
        // parse root json object
        
        JsonObject root = 
            JsonParser.parseString(json).getAsJsonObject();

        // extract nested objects
        JsonObject main =
            root.getAsJsonObject("main");

        JsonObject wind =
            root.getAsJsonObject("wind");
            
        JsonArray weatherArray =
            root.getAsJsonArray("weather");

        JsonObject weather =
            weatherArray.get(0).getAsJsonObject(); 
 
            ///extract fields

            String city =
                    root.get("name").getAsString();

            Double temperature =
                    main.get("temp").getAsDouble();
            
            Double feelsLike =
                    main.get("feels_like").getAsDouble();

            int humidity =
                    main.get("humidity").getAsInt();

            String condition =
                    weather.get("description").getAsString();

            Double windSpeed =
                    wind.get("speed").getAsDouble();

            String weatherCode =
                    weather.get("icon").getAsString();

            int conditionId =
                    weather.get("id").getAsInt();

            int windDeg =
                    wind.get("deg").getAsInt();
                

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

    public WeatherData getWeather (String city) {
        String json = getWeatherJSON(city);

        return parseWeather(json);
    }

}
