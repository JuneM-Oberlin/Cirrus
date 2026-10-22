package com.weatherapp.model;

import java.util.List;

/** The /sixhour response: the city's UTC offset plus its six-hour blocks in time order. */
public class SixHourForecast {

    private int timezoneOffset;
    private List<SixHourBlock> blocks;

    public SixHourForecast(int timezoneOffset, List<SixHourBlock> blocks) {
        this.timezoneOffset = timezoneOffset;
        this.blocks = blocks;
    }

    public int getTimezoneOffset() {
        return timezoneOffset;
    }

    public List<SixHourBlock> getBlocks() {
        return blocks;
    }
}
