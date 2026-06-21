package com.weatherapp.model;

public class WeatherData {

    private String city;
    private double temperature;
    private double feelsLike;
    private int humidity;
    private String condition;
    private double windSpeed;
    private String weatherCode;
    private int conditionId;
    private int windDeg;
    private int visibility;
    private int cloudCover;
    private long sunrise;
    private long sunset;
    private double pressure;
    private double precipitation;
    private double tempMax;
    private double tempMin;
    private double lat;
    private double lon;

    public WeatherData(String city,
            double temperature,
            double feelsLike,
            int humidity,
            String condition,
            double windSpeed,
            String weatherCode,
            int conditionId,
            int windDeg,
            int visibility,
            int cloudCover,
            long sunrise,
            long sunset,
            double pressure,
            double precipitation,
            double tempMin,
            double tempMax,
            double lat,
            double lon) {

        this.city = city;
        this.temperature = temperature;
        this.feelsLike = feelsLike;
        this.humidity = humidity;
        this.condition = condition;
        this.windSpeed = windSpeed;
        this.weatherCode = weatherCode;
        this.conditionId = conditionId;
        this.windDeg = windDeg;
        this.visibility = visibility;
        this.cloudCover = cloudCover;
        this.sunrise = sunrise;
        this.sunset = sunset;
        this.pressure = pressure;
        this.precipitation = precipitation;
        this.tempMin = tempMin;
        this.tempMax = tempMax;
        this.lat = lat;
        this.lon = lon;
    }

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

    public int getWindDeg() {
        return windDeg;
    }

    public int getVisibility() {
        return visibility;
    }

    public int getCloudCover() {
        return cloudCover;
    }

    public long getSunrise() {
        return sunrise;
    }

    public long getSunset() {
        return sunset;
    }

    public double getPressure() {
        return pressure;
    }

    public double getPrecipitation() {
        return precipitation;
    }

    public double getTempMin() {
        return tempMin;
    }

    public double getTempMax() {
        return tempMax;
    }

    public double getLat() {
        return lat;
    }

    public double getLon() {
        return lon;
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
