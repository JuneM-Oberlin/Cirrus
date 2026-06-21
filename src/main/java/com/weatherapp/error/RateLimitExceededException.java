package com.weatherapp.error;

public class RateLimitExceededException extends RuntimeException {

    public static final String DEFAULT_MESSAGE = "Too many requests. Please wait a minute.";

    public RateLimitExceededException(String message) {
        super(message);
    }
}

