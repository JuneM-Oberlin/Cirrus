package com.weatherapp.model;

/** The /uv response: today's peak UV index, its WHO category, and the reading's date. */
public class UvIndex {

    private double value;
    private String category;
    private long date;

    public UvIndex(double value, String category, long date) {
        this.value = value;
        this.category = category;
        this.date = date;
    }

    public double getValue() {
        return value;
    }

    public String getCategory() {
        return category;
    }

    public long getDate() {
        return date;
    }
}
