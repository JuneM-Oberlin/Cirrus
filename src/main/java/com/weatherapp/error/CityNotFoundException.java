package com.weatherapp.error;

public class CityNotFoundException extends RuntimeException {

    public CityNotFoundException(String city) {
        super("City not found: " + city);
    }
}
