const CirrusAtmosphere = (function () {
    const VIDEO_RAIN_EFFECTS = {
        drizzle: "drizzle",
        rain: "rain",
        "rain-heavy": "rain-heavy",
        sleet: "sleet",
        thunderstorm: "rain-heavy",
    };

    const WEATHER_EFFECT_RANGES = [
        [200, 232, "thunderstorm"],
        [300, 321, "drizzle"],
        [500, 501, "rain"],
        [502, 504, "rain-heavy"],
        [510, 511, "sleet"],
        [520, 531, "rain"],
        [600, 602, "snow"],
        [611, 613, "sleet"],
        [615, 616, "sleet"],
        [620, 622, "snow"],
        [701, 762, "fog"],
        [771, 771, "thunderstorm"],
        [781, 781, "thunderstorm"],
        [801, 802, "clouds"],
        [803, Infinity, "clouds-heavy"],
    ];

    function getWeatherEffect(conditionId) {
        const id = Number(conditionId);
        if (!Number.isFinite(id)) {
            return "clear";
        }
        const match = WEATHER_EFFECT_RANGES.find(([min, max]) => id >= min && id <= max);
        return match ? match[2] : "clear";
    }

    function stormLightningProfile(conditionId) {
        const rank = { none: 0, normal: 0, heavy: 1, severe: 2 };
        let best = typeof thunderIconIntensity === "function"
            ? thunderIconIntensity(conditionId)
            : "none";

        const alertRank = CirrusAlerts.getStormLightningRank();
        if (alertRank === "severe" && rank.severe > rank[best]) {
            best = "severe";
        } else if (alertRank === "heavy" && rank.heavy > rank[best]) {
            best = "heavy";
        }

        if (best === "severe") {
            return "severe";
        }
        if (best === "heavy") {
            return "heavy";
        }
        return "normal";
    }

    function setWeatherAtmosphere(conditionId) {
        const layer = document.getElementById("weatherAtmosphere");
        const globe = document.getElementById("globeBg");
        if (!layer) {
            return;
        }

        const effect = getWeatherEffect(conditionId);
        layer.dataset.effect = effect;

        const wantLightning = typeof AtmoLightning !== "undefined"
            && (conditionHasThunder(conditionId) || CirrusAlerts.getStormLightningRank() !== "none");

        const rainProfile = effect === "clear" ? null : VIDEO_RAIN_EFFECTS[effect];
        if (typeof AtmoRainVideo !== "undefined") {
            if (rainProfile) {
                requestAnimationFrame(() => AtmoRainVideo.start(rainProfile));
            } else {
                AtmoRainVideo.stop();
            }
        }

        if (typeof AtmoLightning !== "undefined") {
            if (wantLightning) {
                AtmoLightning.start(stormLightningProfile(conditionId));
            } else {
                AtmoLightning.stop();
            }
        }

        const hasAtmosphere = effect !== "clear" || wantLightning;
        layer.classList.toggle("is-hidden", !hasAtmosphere);
        if (globe) {
            globe.classList.toggle("atmosphere-active", hasAtmosphere);
        }
    }

    function clearWeatherAtmosphere() {
        const layer = document.getElementById("weatherAtmosphere");
        const globe = document.getElementById("globeBg");
        if (typeof AtmoRainVideo !== "undefined") {
            AtmoRainVideo.stop();
        }
        if (typeof AtmoLightning !== "undefined") {
            AtmoLightning.stop();
        }
        if (layer) {
            layer.dataset.effect = "clear";
            layer.classList.add("is-hidden");
        }
        globe?.classList.remove("atmosphere-active");
    }

    return {
        refresh: setWeatherAtmosphere,
        clear: clearWeatherAtmosphere,
    };
})();
