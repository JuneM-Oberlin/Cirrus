package com.weatherapp.model;

/**
 * One six-hour slice of a forecast day in the city's local time:
 * 12 a.m.–6 a.m., 6 a.m.–12 p.m., 12 p.m.–6 p.m., or 6 p.m.–12 a.m.
 */
public class SixHourBlock {

    private String day;
    private String date;
    private int startHour;
    private double high;
    private double low;
    private int rainChance;
    private String condition;
    private String weatherCode;
    private int conditionId;

    public SixHourBlock(String day,
            String date,
            int startHour,
            double high,
            double low,
            int rainChance,
            String condition,
            String weatherCode,
            int conditionId) {
        this.day = day;
        this.date = date;
        this.startHour = startHour;
        this.high = high;
        this.low = low;
        this.rainChance = rainChance;
        this.condition = condition;
        this.weatherCode = weatherCode;
        this.conditionId = conditionId;
    }

    public String getDay() {
        return day;
    }

    public String getDate() {
        return date;
    }

    public int getStartHour() {
        return startHour;
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
}
