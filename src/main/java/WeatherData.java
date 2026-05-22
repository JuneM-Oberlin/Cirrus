public class WeatherData {

    // instance variables
    private String city;
    private double temperature;
    private double feelsLike;
    private int humidity;
    private String condition;
    private double windSpeed;
    private String weatherCode;

    public WeatherData(String city,
                        double temperature,
                        double feelsLike,
                        int humidity,
                        String condition,
                        double windSpeed,
                        String weatherCode){
     
     this.city = city;
     this.temperature = temperature;
     this.feelsLike = feelsLike;
     this.humidity = humidity;
     this.condition = condition;
     this.windSpeed = windSpeed;
     this.weatherCode = weatherCode;
    }

    // getter methods

    
}
