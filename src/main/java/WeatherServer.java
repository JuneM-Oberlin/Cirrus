import com.google.gson.Gson;

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


        //GET /weather route
        get("weather", (req, res) ->  {

            //read city query param
            String city = req.queryParams("city");

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
                res.type("application.json");

                return gson.toJson(
                        new ErrorResponse("City not found.")   
                );
            }
        });
    }
        

    private static void enableCORS() {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'enableCORS'");
    }
    
}
