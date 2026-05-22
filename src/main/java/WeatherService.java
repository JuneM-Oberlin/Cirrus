

import okhttp3.OkHttpClient;
import okhttp3.Request;




public class WeatherService {

    public String getWeatherJSON(String city) {
        String apiKey = System.getenv("WEATHER_API_KEY");

        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException("WEATHER_API_KEY environment variable is not set");
        }
        // replace spaces with +
        String formattedCity = city.replace(" ", "+");

        //request URL
        String url =
           "https://api.openweathermap.org/data/2.5/weather" +
            "?q=" + formattedCity +
            "&appid=" + apiKey +
            "&units=imperial"; 

            //http client
            OkHttpClient client = new OkHttpClient();

            // build request
            Request request = new Request.Builder()
                    .url(url)
                    .build();

            //send request and return response

            




        // Placeholder: implement actual HTTP call to weather API and return JSON string
        return "{}";
    }

}
