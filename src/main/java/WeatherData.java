
public class WeatherData {

    // instance variables
    private String city;
    private double temperature;
    private double feelsLike;
    private int humidity;
    private String condition;
    private double windSpeed;
    private String weatherCode;
    private int conditionId;

    public WeatherData(String city,
            double temperature,
            double feelsLike,
            int humidity,
            String condition,
            double windSpeed,
            String weatherCode,
            int conditionId) {

        this.city = city;
        this.temperature = temperature;
        this.feelsLike = feelsLike;
        this.humidity = humidity;
        this.condition = condition;
        this.windSpeed = windSpeed;
        this.weatherCode = weatherCode;
        this.conditionId = conditionId;
    }

    // getter methods
    public String getCity() {
        return city;
    }

    public double getTemperature() {
        return temperature;
    }

    public double getFeelsLike() {
        return feelsLike;
    }

    public int getHumidity() {
        return humidity;
    }

    public String getCondition() {
        return condition;
    }

    public double getWindSpeed() {
        return windSpeed;
    }

    public String getWeatherCode() {
        return weatherCode;
    }

    public int getConditionId() {
        return conditionId;
    }

    @Override
    public String toString() {
        return String.format(
                "City:      %s%n"
                + "Temperature: %.1f F  (Feels like %.1f F)%n"
                + "Humidity:  %d%%%n"
                + "Condition: %s%n"
                + "Wind:      %.1f mph",
                city,
                temperature,
                feelsLike,
                humidity,
                condition,
                windSpeed
        );

    }
}
