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
        byId("currentEmpty").classList.remove("hidden");
        byId("currentHero").classList.add("hidden");
        frame.setReadout("current", null);
        frame.setAsOf("");
    }

    function renderCurrent(weather) {
        byId("currentEmpty").classList.add("hidden");
        byId("currentHero").classList.remove("hidden");

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

    // data: { weather, forecast, loadedAt }
    function render(data) {
        renderCurrent(data.weather);
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
