/* Renders the data into each view of the frame. Every function builds
   DOM nodes with textContent, so API strings are never parsed as HTML. */

const CirrusViews = (function () {
    const COMPASS = [
        "N", "NNE", "NE", "ENE",
        "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW",
        "W", "WNW", "NW", "NNW",
    ];

    const WEEKDAYS = {
        Sun: "Sunday",
        Mon: "Monday",
        Tue: "Tuesday",
        Wed: "Wednesday",
        Thu: "Thursday",
        Fri: "Friday",
        Sat: "Saturday",
    };

    let frame = null;
    let units = null;
    let forecastDays = [];

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

    function fullWeekday(shortName) {
        if (WEEKDAYS[shortName]) {
            return WEEKDAYS[shortName];
        }
        return shortName || "Forecast";
    }

    function isWeekend(shortName) {
        return shortName === "Sat" || shortName === "Sun";
    }

    function dayReadout(day) {
        let rainChance = day.rainChance;
        if (rainChance === undefined || rainChance === null) {
            rainChance = 0;
        }
        let precipInches = 0;
        if (day.precipitation) {
            precipInches = day.precipitation / 25.4;
        }
        return {
            main: "Wind " + units.wind(day.windSpeed || 0),
            stats: [
                { text: "Chance of rain " + rainChance + "%" },
                { text: "Precipitation " + units.precip(precipInches) },
            ],
        };
    }

    // Today, Tomorrow, and the day screen share one layout: yellow high,
    // cyan low, the condition, and a daytime icon.
    function fillDay(prefix, day) {
        const high = byId(prefix + "High");
        high.textContent = units.temp(day.high);
        high.setAttribute("aria-label", "High " + units.tempNumber(day.high) + " " + units.tempUnitName());
        const low = byId(prefix + "Low");
        low.textContent = units.temp(day.low);
        low.setAttribute("aria-label", "Low " + units.tempNumber(day.low) + " " + units.tempUnitName());

        const condition = titleCase(day.condition);
        byId(prefix + "Cond").textContent = condition;
        setIcon(byId(prefix + "Icon"), day.conditionId, "", condition);
    }

    function renderDay(prefix, viewId, day) {
        if (!day) {
            frame.setReadout(viewId, null);
            return;
        }
        fillDay(prefix, day);
        frame.setReadout(viewId, dayReadout(day));
    }

    // Opens one forecast day full-panel, titled with its weekday name.
    function openDay(index) {
        const day = forecastDays[index];
        if (!day) {
            return;
        }
        fillDay("day", day);
        frame.openScreen("day", {
            title: fullWeekday(day.day),
            readout: dayReadout(day),
        });
    }

    function renderFiveDay(days) {
        const list = byId("fivedayList");
        list.replaceChildren();
        days.slice(0, 5).forEach((day, index) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "fiveday-col";
            const condition = titleCase(day.condition);
            button.setAttribute("aria-label",
                fullWeekday(day.day) + ": " + condition + ", high " + units.temp(day.high)
                + ", low " + units.temp(day.low) + ". Open details");

            const name = document.createElement("span");
            name.className = "fiveday-day";
            if (isWeekend(day.day)) {
                name.classList.add("is-weekend");
            }
            name.textContent = String(day.day || "").toUpperCase();

            const icon = document.createElement("img");
            icon.className = "fiveday-icon";
            setIcon(icon, day.conditionId, "", "");

            const high = document.createElement("span");
            high.className = "fiveday-high";
            high.textContent = String(units.tempNumber(day.high));

            const low = document.createElement("span");
            low.className = "fiveday-low";
            low.textContent = String(units.tempNumber(day.low));

            button.append(name, icon, high, low);
            button.addEventListener("click", () => openDay(index));
            item.appendChild(button);
            list.appendChild(item);
        });
    }

    const BLOCK_HOURS = 6;

    // Short WHO sun-safety guidance for each UV band.
    const UV_ADVICE = {
        "Low": "Little protection needed. Sunglasses help on bright days.",
        "Moderate": "Seek shade around midday and wear sunscreen and a hat.",
        "High": "Limit sun from 10 a.m. to 4 p.m. Use SPF 30+, a hat, and sunglasses.",
        "Very High": "Avoid the midday sun. Shade, SPF 30+, a hat, and sunglasses are a must.",
        "Extreme": "Stay out of the midday sun. Unprotected skin can burn in minutes.",
    };

    // uv: undefined while loading, null when unavailable, else { value, category }.
    function renderUv(uv) {
        const value = byId("uvValue");
        const category = byId("uvCategory");
        const advice = byId("uvAdvice");
        let current = "";

        if (uv === undefined) {
            value.textContent = "--";
            category.textContent = "Loading";
            advice.textContent = "";
            value.removeAttribute("aria-label");
        } else if (uv === null) {
            value.textContent = "--";
            category.textContent = "UV data unavailable";
            advice.textContent = "The UV service didn't answer. Try again later.";
            value.removeAttribute("aria-label");
        } else {
            const rounded = Math.round(uv.value);
            current = uv.category;
            value.textContent = String(rounded);
            value.setAttribute("aria-label", "UV index " + rounded);
            category.textContent = uv.category;
            advice.textContent = UV_ADVICE[uv.category] || "";
        }

        document.querySelectorAll("#uvScale .uv-band").forEach((band) => {
            band.classList.toggle("is-current", band.dataset.band === current);
        });
    }

    // Tomorrow's four six-hour tiles, titled with tomorrow's weekday.
    function renderSixHour(sixHour, loadedAt) {
        const list = byId("sixhourList");
        const note = byId("sixhourNote");
        list.replaceChildren();
        if (!sixHour || !Array.isArray(sixHour.blocks)) {
            note.classList.remove("hidden");
            frame.setViewTitle("sixhour", "");
            return;
        }

        const tomorrow = units.cityDateKey(loadedAt, sixHour.timezoneOffset, 1);
        const blocks = sixHour.blocks.filter((block) => block.date === tomorrow);
        note.classList.toggle("hidden", blocks.length > 0);
        if (blocks.length > 0) {
            frame.setViewTitle("sixhour", fullWeekday(blocks[0].day));
        } else {
            frame.setViewTitle("sixhour", "");
        }

        blocks.forEach((block) => {
            const start = units.hourLabel(block.startHour);
            const end = units.hourLabel(block.startHour + BLOCK_HOURS);
            const condition = titleCase(block.condition);

            const item = document.createElement("li");
            item.className = "sixhour-tile";
            item.setAttribute("aria-label",
                start + " to " + end + ": " + condition + ", high " + units.temp(block.high)
                + ", low " + units.temp(block.low) + ", chance of rain " + block.rainChance + "%");

            const icon = document.createElement("img");
            icon.className = "sixhour-icon";
            setIcon(icon, block.conditionId, block.weatherCode, "");

            const temps = document.createElement("p");
            temps.className = "sixhour-temps";
            temps.setAttribute("aria-hidden", "true");
            const high = document.createElement("span");
            high.className = "sixhour-high";
            high.textContent = units.temp(block.high);
            const low = document.createElement("span");
            low.className = "sixhour-low";
            low.textContent = units.temp(block.low);
            temps.append(high, low);

            const time = document.createElement("p");
            time.className = "sixhour-time";
            time.setAttribute("aria-hidden", "true");
            time.textContent = start + " –\n" + end;

            item.append(icon, temps, time);
            list.appendChild(item);
        });
    }

    // data: { weather, forecast, sixHour, loadedAt }
    function render(data) {
        byId("framePanel").classList.add("has-data");
        renderCurrent(data.weather);
        renderDay("today", "today", data.forecast[0]);
        renderDay("tomorrow", "tomorrow", data.forecast[1]);
        forecastDays = data.forecast;
        renderFiveDay(data.forecast);
        renderSixHour(data.sixHour, data.loadedAt);
        renderUv(data.uv);
        frame.setAsOf(units.asOf(data.loadedAt, data.weather.timezoneOffset));
    }

    return {
        init,
        render,
        renderUv,
        showEmpty,
        openDay,
        iconPath,
        degreesToCompass,
        titleCase,
    };
})();
