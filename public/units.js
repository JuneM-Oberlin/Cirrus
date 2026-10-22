/* Units and formatting shared by every view.
   The API always answers in Fahrenheit, mph, miles, inches, and hPa;
   the saved settings decide what the page shows. */

const CirrusUnits = (function () {
    const SETTINGS_KEY = "cirrus_units";
    const KMH_PER_MPH = 1.609344;
    const KM_PER_MILE = 1.609344;
    const MM_PER_INCH = 25.4;
    const INHG_PER_HPA = 0.02953;

    let settings = loadSettings();
    const listeners = [];

    function loadSettings() {
        const result = { temp: "F", wind: "mph" };
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved.temp === "C") {
                    result.temp = "C";
                }
                if (saved.wind === "kmh") {
                    result.wind = "kmh";
                }
            }
        } catch (err) {
            console.log("Could not read unit settings:", err);
        }
        return result;
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (err) {
            console.log("Could not save unit settings:", err);
        }
    }

    function getSettings() {
        return { temp: settings.temp, wind: settings.wind };
    }

    function update(changes) {
        if (changes.temp === "F" || changes.temp === "C") {
            settings.temp = changes.temp;
        }
        if (changes.wind === "mph" || changes.wind === "kmh") {
            settings.wind = changes.wind;
        }
        saveSettings();
        listeners.forEach((listener) => listener(getSettings()));
    }

    function onChange(listener) {
        listeners.push(listener);
    }

    function isMetricDistance() {
        return settings.wind === "kmh";
    }

    // Whole-degree temperature in the chosen unit, e.g. 69 or 21.
    function tempNumber(fahrenheit) {
        if (settings.temp === "C") {
            return Math.round((fahrenheit - 32) * 5 / 9);
        }
        return Math.round(fahrenheit);
    }

    // "69°" in Fahrenheit, "21°C" in Celsius (like the references).
    function temp(fahrenheit) {
        if (settings.temp === "C") {
            return tempNumber(fahrenheit) + "°C";
        }
        return tempNumber(fahrenheit) + "°";
    }

    function tempUnitName() {
        if (settings.temp === "C") {
            return "degrees Celsius";
        }
        return "degrees Fahrenheit";
    }

    function wind(mph) {
        if (settings.wind === "kmh") {
            return Math.round(mph * KMH_PER_MPH) + " km/h";
        }
        return Math.round(mph) + " mph";
    }

    function distance(miles) {
        if (isMetricDistance()) {
            return (miles * KM_PER_MILE).toFixed(1) + " km";
        }
        return miles.toFixed(1) + " mi";
    }

    function precip(inches) {
        if (isMetricDistance()) {
            const mm = inches * MM_PER_INCH;
            if (mm <= 0) {
                return "0 mm";
            }
            return mm.toFixed(1) + " mm";
        }
        if (inches <= 0) {
            return "0 in";
        }
        return inches.toFixed(2) + " in";
    }

    function pressure(hpa) {
        if (isMetricDistance()) {
            return Math.round(hpa) + " hPa";
        }
        return (hpa * INHG_PER_HPA).toFixed(2) + " in";
    }

    // A Date whose UTC fields read as the city's local wall clock.
    function cityDate(unixMs, timezoneOffsetSeconds) {
        return new Date(unixMs + (timezoneOffsetSeconds || 0) * 1000);
    }

    // "6:46 p.m." — the lowercase, dotted style the references use.
    function clockTime(date) {
        let hours = date.getUTCHours();
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        let suffix = "a.m.";
        if (hours >= 12) {
            suffix = "p.m.";
        }
        hours = hours % 12;
        if (hours === 0) {
            hours = 12;
        }
        return hours + ":" + minutes + " " + suffix;
    }

    function cityClockTime(unixSeconds, timezoneOffsetSeconds) {
        if (!unixSeconds) {
            return "--";
        }
        return clockTime(cityDate(unixSeconds * 1000, timezoneOffsetSeconds));
    }

    // "As of 6:46 p.m., 10/21"
    function asOf(unixMs, timezoneOffsetSeconds) {
        const date = cityDate(unixMs, timezoneOffsetSeconds);
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return "As of " + clockTime(date) + ", " + month + "/" + day;
    }

    return {
        getSettings,
        update,
        onChange,
        tempNumber,
        temp,
        tempUnitName,
        wind,
        distance,
        precip,
        pressure,
        cityDate,
        clockTime,
        cityClockTime,
        asOf,
    };
})();
