package com.weatherapp.model;

public class WeatherAlert {

    private String id;
    private String event;
    private String tier;
    private int tierRank;
    private String severity;
    private String headline;
    private String description;
    private String instruction;
    private String senderName;
    private String areaDesc;
    private long effective;
    private long expires;
    private long ends;
    private String urgency;
    private String certainty;

    public WeatherAlert(
            String id,
            String event,
            String tier,
            int tierRank,
            String severity,
            String headline,
            String description,
            String instruction,
            String senderName,
            String areaDesc,
            long effective,
            long expires,
            long ends,
            String urgency,
            String certainty) {
        this.id = id;
        this.event = event;
        this.tier = tier;
        this.tierRank = tierRank;
        this.severity = severity;
        this.headline = headline;
        this.description = description;
        this.instruction = instruction;
        this.senderName = senderName;
        this.areaDesc = areaDesc;
        this.effective = effective;
        this.expires = expires;
        this.ends = ends;
        this.urgency = urgency;
        this.certainty = certainty;
    }

    public String getId() {
        return id;
    }

    public String getEvent() {
        return event;
    }

    public String getTier() {
        return tier;
    }

    public int getTierRank() {
        return tierRank;
    }

    public String getSeverity() {
        return severity;
    }

    public String getHeadline() {
        return headline;
    }

    public String getDescription() {
        return description;
    }

    public String getInstruction() {
        return instruction;
    }

    public String getSenderName() {
        return senderName;
    }

    public String getAreaDesc() {
        return areaDesc;
    }

    public long getEffective() {
        return effective;
    }

    public long getExpires() {
        return expires;
    }

    public long getEnds() {
        return ends;
    }

    public String getUrgency() {
        return urgency;
    }

    public String getCertainty() {
        return certainty;
    }
}
