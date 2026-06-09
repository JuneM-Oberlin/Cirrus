
public class ForecastDay {

    private String day;
    private double high;
    private double low;
    private int rainChance;
    private String condition;
    private String weatherCode;
    private int conditionId;
    private double windSpeed;
    private double precipitation; // total daily volume in mm

    public ForecastDay(String day,
            double high,
            double low,
            int rainChance,
            String condition,
            String weatherCode,
            int conditionId,
            double windSpeed,
            double precipitation) {
        this.day = day;
        this.high = high;
        this.low = low;
        this.rainChance = rainChance;
        this.condition = condition;
        this.weatherCode = weatherCode;
        this.conditionId = conditionId;
        this.windSpeed = windSpeed;
        this.precipitation = precipitation;
    }

    public String getDay() {
        return day;
    }

    public double getHigh() {
        return high;
    }

    public double getLow() {
        return low;
    }

    public int getRainChance() {
        return rainChance;
    }

    public String getCondition() {
        return condition;
    }

    public String getWeatherCode() {
        return weatherCode;
    }

    public int getConditionId() {
        return conditionId;
    }

    public double getWindSpeed() {
        return windSpeed;
    }

    public double getPrecipitation() {
        return precipitation;
    }
}
