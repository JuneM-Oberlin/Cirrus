/* Renders the data into each view of the frame. Every function builds
   DOM nodes with textContent, so API strings are never parsed as HTML. */

const CirrusViews = (function () {
    const COMPASS = [
        "N", "NNE", "NE", "ENE",
        "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW",
        "W", "WNW", "NW", "NNW",
    ];

    let frame = null;
    let units = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function init(deps) {
        frame = deps.frame;
        units = deps.units;
    }

    function degreesToCompass(deg) {
        const index = Math.round(deg / 22.5) % 16;
        return COMPASS[index];
    }

    function titleCase(text) {
        return String(text || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    // Night codes ("04n") use the moon variants of the icon set.
    function iconPath(conditionId, weatherCode) {
        let key = conditionId;
        if (weatherCode && weatherCode.endsWith("n") && iconMap[conditionId + "n"]) {
            key = conditionId + "n";
        }
        return "icons/" + (iconMap[key] || "default.png");
    }

    function setIcon(img, conditionId, weatherCode, alt) {
        img.src = iconPath(conditionId, weatherCode);
        img.alt = alt || "";
    }

    // Temperature moods on the current temperature: shiver below freezing,
    // heat shimmer from 95°F up (speed and size scale with the heat).
    function applyTempMood(el, fahrenheit) {
        el.classList.toggle("temp--freezing", fahrenheit < 32);
        const hot = fahrenheit >= 95;
        el.classList.toggle("temp--hot", hot);
        if (hot) {
            const intensity = Math.min((fahrenheit - 95) / 25, 1);
            el.style.setProperty("--heat-amp", (0.3 + intensity * 0.7).toFixed(2) + "px");
            el.style.setProperty("--heat-speed", (0.5 - intensity * 0.15).toFixed(2) + "s");
        } else {
            el.style.removeProperty("--heat-amp");
            el.style.removeProperty("--heat-speed");
        }
    }

    function showEmpty() {
        byId("framePanel").classList.remove("has-data");
        ["current", "today", "tomorrow"].forEach((id) => frame.setReadout(id, null));
        frame.setAsOf("");
    }

    function renderCurrent(weather) {
        const temp = byId("currentTemp");
        temp.textContent = units.temp(weather.temperature);
        temp.setAttribute("aria-label", units.tempNumber(weather.temperature) + " " + units.tempUnitName());
        applyTempMood(temp, weather.temperature);

        const condition = titleCase(weather.description || weather.condition);
        byId("currentCond").textContent = condition;
        setIcon(byId("currentIcon"), weather.conditionId, weather.weatherCode, condition);

        frame.setReadout("current", {
            main: degreesToCompass(weather.windDeg) + " " + units.wind(weather.windSpeed),
            stats: [
                { text: "Feels like " + units.temp(weather.feelsLike) },
                { text: "Humidity " + weather.humidity + "%" },
                { text: "Clouds " + weather.cloudCover + "%", extra: true },
                { text: "Visibility " + units.distance(weather.visibility / 1609.34), extra: true },
                { text: "Pressure " + units.pressure(weather.pressure), extra: true },
                { text: "Sunrise " + units.cityClockTime(weather.sunrise, weather.timezoneOffset) },
                { text: "Sunset " + units.cityClockTime(weather.sunset, weather.timezoneOffset) },
            ],
        });
    }

    // Today and Tomorrow share one layout: yellow high, cyan low, the
    // condition, a daytime icon, and wind plus rain chance in the readout.
    function renderDay(prefix, viewId, day) {
        if (!day) {
            frame.setReadout(viewId, null);
            return;
        }
        const high = byId(prefix + "High");
        high.textContent = units.temp(day.high);
        high.setAttribute("aria-label", "High " + units.tempNumber(day.high) + " " + units.tempUnitName());
        const low = byId(prefix + "Low");
        low.textContent = units.temp(day.low);
        low.setAttribute("aria-label", "Low " + units.tempNumber(day.low) + " " + units.tempUnitName());

        const condition = titleCase(day.condition);
        byId(prefix + "Cond").textContent = condition;
        setIcon(byId(prefix + "Icon"), day.conditionId, "", condition);

        let rainChance = day.rainChance;
        if (rainChance === undefined || rainChance === null) {
            rainChance = 0;
        }
        let precipInches = 0;
        if (day.precipitation) {
            precipInches = day.precipitation / 25.4;
        }
        frame.setReadout(viewId, {
            main: "Wind " + units.wind(day.windSpeed || 0),
            stats: [
                { text: "Chance of rain " + rainChance + "%" },
                { text: "Precipitation " + units.precip(precipInches) },
            ],
        });
    }

    // data: { weather, forecast, loadedAt }
    function render(data) {
        byId("framePanel").classList.add("has-data");
        renderCurrent(data.weather);
        renderDay("today", "today", data.forecast[0]);
        renderDay("tomorrow", "tomorrow", data.forecast[1]);
        frame.setAsOf(units.asOf(data.loadedAt, data.weather.timezoneOffset));
    }

    return {
        init,
        render,
        showEmpty,
        iconPath,
        degreesToCompass,
        titleCase,
    };
})();
