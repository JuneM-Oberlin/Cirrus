const CirrusAtmosphere = (function () {
    const VIDEO_RAIN_EFFECTS = {
        drizzle: "drizzle",
        rain: "rain",
        "rain-heavy": "rain-heavy",
        sleet: "sleet",
        thunderstorm: "rain-heavy",
    };

    function getWeatherEffect(conditionId) {
        const id = Number(conditionId);
        if (!Number.isFinite(id)) {
            return "clear";
        }

        if (id >= 200 && id <= 232) {
            return "thunderstorm";
        }
        if (id >= 300 && id <= 321) {
            return "drizzle";
        }
        if (id >= 500 && id <= 501) {
            return "rain";
        }
        if (id >= 502 && id <= 504) {
            return "rain-heavy";
        }
        if (id === 510 || id === 511 || id === 611 || id === 612 || id === 613
            || id === 615 || id === 616) {
            return "sleet";
        }
        if (id >= 520 && id <= 531) {
            return "rain";
        }
        if ((id >= 600 && id <= 602) || (id >= 620 && id <= 622)) {
            return "snow";
        }
        if (id === 771 || id === 781) {
            return "thunderstorm";
        }
        if (id >= 701 && id <= 762) {
            return "fog";
        }
        if (id === 801 || id === 802) {
            return "clouds";
        }
        if (id >= 803) {
            return "clouds-heavy";
        }
        return "clear";
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
