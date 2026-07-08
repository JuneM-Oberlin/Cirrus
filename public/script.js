//helper show or hide id
function show(id) {document.getElementById(id).classList.remove("hidden");}
function hide(id) {document.getElementById(id).classList.add("hidden");}
function set(id, value) {document.getElementById(id).textContent = value;}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playAnimation(el, className) {
    if (!el || prefersReducedMotion()) {
        return;
    }
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    el.addEventListener("animationend", () => el.classList.remove(className), { once: true });
}

function triggerWeatherReveal() {
    const card = document.getElementById("weatherDisplay");
    const temp = document.getElementById("tempMain");
    const city = document.getElementById("cityName");
    playAnimation(card, "anim-card-reveal");
    playAnimation(temp, "anim-temp-pop");
    playAnimation(city, "anim-city-pop");
}

function showError(message) {
    set("errorMsg", message);
    const el = document.getElementById("errorMsg");
    el.classList.remove("hidden");
    playAnimation(el, "anim-wiggle");
}

function bounceTab(tabEl) {
    playAnimation(tabEl, "anim-tab-bounce");
}

const HISTORY_KEY = "cirrus_city_history";
const MAX_HISTORY = 8;

let activeTimezoneOffset = 0;
let currentWeatherConditionId = null;

function degreesToCompass(deg) {
    const directions = [
        "N", "NNE", "NE", "ENE",
        "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW",
        "W", "WNW", "NW", "NNW"
    ];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
}

function formatCityLabel(city) {
    return city.trim().split(/\s+/).map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
}

function hpaToInHg(hpa) {
    return (hpa * 0.02953).toFixed(2);
}

function formatCityTime(unixSeconds, timezoneOffsetSeconds) {
    if (!unixSeconds) {
        return "--";
    }
    const date = new Date((unixSeconds + (timezoneOffsetSeconds || 0)) * 1000);
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

function formatCityNow(timezoneOffsetSeconds) {
    const unixSeconds = Math.floor(Date.now() / 1000);
    const date = new Date((unixSeconds + (timezoneOffsetSeconds || 0)) * 1000);
    return {
        time: date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
        }),
        date: date.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            timeZone: "UTC",
        }),
    };
}

function loadHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (err) {
        console.log("Could not load search history:", err);
        return [];
    }
}

function saveHistory(cities) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(cities));
}

function addToHistory(city) {
    const trimmed = city.trim();
    if (!trimmed) {
        return;
    }

    const key = normalizeCityKey(trimmed);
    let cities = loadHistory().filter((entry) => normalizeCityKey(entry) !== key);
    cities.unshift(trimmed);
    if (cities.length > MAX_HISTORY) {
        cities = cities.slice(0, MAX_HISTORY);
    }
    saveHistory(cities);
    renderHistory();
}

function renderHistory({ animate = true } = {}) {
    const container = document.getElementById("historyList");
    if (!container) {
        return;
    }

    container.replaceChildren();
    loadHistory().forEach((city) => {
        const chip = document.createElement("span");
        chip.textContent = city;
        chip.dataset.cityKey = normalizeCityKey(city);
        chip.setAttribute("role", "button");
        chip.tabIndex = 0;
        chip.addEventListener("click", () => selectHistoryCity(city));
        chip.addEventListener("keydown", (event) =>
            activateOnEnterOrSpace(event, () => selectHistoryCity(city))
        );
        container.appendChild(chip);
    });

    updateHistoryFilter();

    if (animate && container.children.length && !prefersReducedMotion()) {
        container.classList.remove("history--enter");
        void container.offsetWidth;
        container.classList.add("history--enter");
        container.addEventListener(
            "animationend",
            () => container.classList.remove("history--enter"),
            { once: true }
        );
    }
}

function updateHistoryFilter() {
    const container = document.getElementById("historyList");
    if (!container) {
        return;
    }

    const inputKey = normalizeCityKey(document.getElementById("cityInput").value);
    container.querySelectorAll("span[role=button]").forEach((chip) => {
        chip.hidden = inputKey !== "" && chip.dataset.cityKey === inputKey;
    });
}

function selectHistoryCity(city) {
    document.getElementById("cityInput").value = city;
    searchCity();
}

function activateOnEnterOrSpace(event, action) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
    }
}

// GitHub Pages serves only static files (no backend), so point it at the EC2 API.
// Anywhere else (EC2, localhost), the app's own server handles the API — stay same-origin.
const BACKEND_URL = location.hostname.endsWith(".github.io")
    ? "https://cirrus-project1.duckdns.org"
    : "";

fetch(`${BACKEND_URL}/health`).catch(() => {});

const clientCache = {
    weather: new Map(),
    forecast: new Map(),
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeCityKey(city) {
    return (city || "").trim().toLowerCase();
}

function getCachedEntry(cache, key) {
    const entry = cache.get(key);
    if (!entry) {
        return null;
    }

    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }

    return entry.value;
}

function setCachedEntry(cache, key, value) {
    cache.set(key, {
        value,
        expiry: Date.now() + CLIENT_CACHE_TTL_MS,
    });
}

function normalizeBackendWeatherData(data) {
    return {
        city: data.city,
        temperature: data.temperature,
        feelsLike: data.feelsLike,
        humidity: data.humidity,
        condition: data.condition,
        windSpeed: data.windSpeed,
        weatherCode: data.weatherCode,
        conditionId: data.conditionId,
        windDeg: data.windDeg,
        description: data.description || data.condition,
        visibility: data.visibility,
        cloudCover: data.cloudCover,
        pressure: data.pressure,
        sunrise: data.sunrise,
        sunset: data.sunset,
        lat: data.lat,
        lon: data.lon,
        timezoneOffset: data.timezoneOffset ?? 0,
    };
}

async function readBackendError(response) {
    if (response.status === 404) {
        return "City not found — check the spelling and try again.";
    }
    if (response.status === 429) {
        return "Too many searches — please wait a minute and try again.";
    }
    if (response.status >= 500) {
        return "Server error — try again in a moment.";
    }

    let errorMessage = "Something went wrong.";
    try {
        const err = await response.json();
        errorMessage = err.error || errorMessage;
    } catch (parseError) {
        console.log("Could not parse backend error response:", parseError);
    }
    return errorMessage;
}

function networkErrorMessage() {
    if (!navigator.onLine) {
        return "You're offline — check your connection and try again.";
    }
    return "Couldn't reach the server — check your connection and try again.";
}

async function fetchCached(path, city, cache, normalize = (d) => d) {
    const key = normalizeCityKey(city);
    const cached = getCachedEntry(cache, key);
    if (cached) {
        return cached;
    }

    let response;
    try {
        response = await fetch(`${BACKEND_URL}/${path}?city=${encodeURIComponent(city)}`);
    } catch (fetchError) {
        throw new Error(networkErrorMessage());
    }

    if (!response.ok) {
        throw new Error(await readBackendError(response));
    }

    const data = normalize(await response.json());
    setCachedEntry(cache, key, data);
    return data;
}

function fetchWeatherData(city) {
    return fetchCached("weather", city, clientCache.weather, normalizeBackendWeatherData);
}

function fetchForecastData(city) {
    return fetchCached("forecast", city, clientCache.forecast);
}

function updateTodayEmptyState() {
    if (!CirrusForecast.isForecastTabActive()
        && document.getElementById("weatherDisplay").classList.contains("hidden")) {
        show("todayEmpty");
    } else {
        hide("todayEmpty");
    }
}

function applyWeatherContext(weatherData, { showToday = true } = {}) {
    activeTimezoneOffset = weatherData.timezoneOffset ?? 0;
    currentWeatherConditionId = weatherData.conditionId;
    const isNight = weatherData.weatherCode.endsWith("n");
    document.body.classList.toggle("theme-day", !isNight);
    if (showToday) {
        renderTodayView(weatherData, isNight);
        hide("todayEmpty");
    }
    CirrusAtmosphere.refresh(weatherData.conditionId);
    updateGlobe(weatherData.lat, weatherData.lon);
    CirrusAlerts.checkAlerts(weatherData);
}

function completeForecastLoad(city, weatherData, forecastData) {
    set("cityName", formatCityLabel(city));
    updateHeaderCityVisibility();
    applyWeatherContext(weatherData, { showToday: false });
    CirrusForecast.render(forecastData, weatherData.timezoneOffset);
    addToHistory(city);
}

function updateHeaderCityVisibility() {
    const headerCity = document.getElementById("cityName");
    const inputValue = document.getElementById("cityInput").value.trim();
    const headerText = headerCity.textContent.trim();
    const isRedundant = inputValue
        && headerText !== "--"
        && normalizeCityKey(headerText) === normalizeCityKey(inputValue);

    headerCity.classList.toggle("header-city--redundant", isRedundant);
}

let coldStartTimers = [];

function startColdStartLoading(initialMessage) {
    stopColdStartLoading();
    CirrusSearchUI.setSearching(true);
    set("loading", initialMessage);
    show("loading");

    const startedAt = Date.now();
    coldStartTimers.push(setTimeout(() => {
        set("loading", "Waking up the server — first search can take up to a minute");
    }, 4000));

    coldStartTimers.push(setTimeout(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        set("loading", `Still connecting (${elapsed}s)`);
    }, 15000));

    coldStartTimers.push(setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        if (elapsed >= 15) {
            set("loading", `Still connecting (${elapsed}s)`);
        }
    }, 1000));

    coldStartTimers.push(setTimeout(() => {
        set("loading", "Almost there — free-tier servers can be slow on cold start.");
    }, 30000));
}

function stopColdStartLoading() {
    coldStartTimers.forEach((timerId) => {
        clearTimeout(timerId);
        clearInterval(timerId);
    });
    coldStartTimers = [];
    CirrusSearchUI.setSearching(false);
}

async function withLoading(task, {
    revealWeather = true,
    loadingMessage = "Fetching weather",
    preserveAlertSession = false,
} = {}) {
    if (!preserveAlertSession) {
        CirrusAlerts.resetForSearch();
        CirrusAtmosphere.clear();
    }
    startColdStartLoading(loadingMessage);
    if (revealWeather) {
        hide("weatherDisplay");
    }
    hide("errorMsg");

    try {
        await task();
        if (revealWeather) {
            show("weatherDisplay");
            triggerWeatherReveal();
        }
    } catch (err) {
        console.log("Search error:", err);
        showError(err.message || "Could not load weather data.");
        if (CirrusForecast.isForecastTabActive()) {
            CirrusForecast.updateForecastEmptyState();
        }
    } finally {
        stopColdStartLoading();
        hide("loading");
    }
}

function searchCity() {
    const city = document.getElementById("cityInput").value.trim();
    if (!city) {
        return;
    }

    CirrusSearchUI.playPressGlow();

    if (CirrusForecast.isForecastTabActive()) {
        searchForecast(city);
    } else {
        searchToday(city);
    }
}

function searchToday(city) {
    withLoading(async () => {
        applyWeatherContext(await fetchWeatherData(city), { showToday: true });
        addToHistory(city);
    });
}

function searchForecast(city) {
    CirrusForecast.prepareSearch();

    withLoading(async () => {
        const [weatherData, forecastData] = await Promise.all([
            fetchWeatherData(city),
            fetchForecastData(city),
        ]);
        completeForecastLoad(city, weatherData, forecastData);
    }, { revealWeather: false, loadingMessage: "Fetching forecast" });
}

function getFeelsLikeExplanation(temp, feelsLike, windSpeed, humidity) {
    const diff = temp - feelsLike;

    if (diff >= 5 && windSpeed > 10) {
        return "Feels colder due to wind";
    } else if (diff >= 3) {
        return "Feels cooler than actual temp";
    } else if (diff <= -3 && humidity > 70) {
        return "Feels warmer due to humidity";
    } else if (diff <= -5) {
        return "Feels hotter than actual temp";
    } else {
        return "Feels about the same";
    }
}

function updateGlobe(lat, lon) {
    const width  = 1024;
    const height = 512;
    const spread = 18;

    const minLon = Math.max(lon - spread, -180);
    const maxLon = Math.min(lon + spread,  180);
    const minLat = Math.max(lat - spread / 2, -90);
    const maxLat = Math.min(lat + spread / 2,  90);

    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    const nasaUrl = [
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        "?SERVICE=WMS",
        "&VERSION=1.1.1",
        "&REQUEST=GetMap",
        "&LAYERS=BlueMarble_ShadedRelief_Bathymetry",
        "&FORMAT=image/jpeg",
        "&TRANSPARENT=false",
        `&WIDTH=${width}`,
        `&HEIGHT=${height}`,
        "&SRS=EPSG:4326",
        `&BBOX=${bbox}`,
    ].join("");

    const globe = document.getElementById("globeBg");

    const img = new Image();
    img.onload = () => {
        globe.style.backgroundImage = `url('${nasaUrl}')`;
        globe.classList.remove("globe-hidden");
    };
    img.onerror = () => {
        globe.classList.add("globe-hidden");
    };
    img.src = nasaUrl;
}

function applyTempMood(temperature) {
    const temp = document.getElementById("tempMain");
    temp.classList.toggle("temp--freezing", temperature < 32);

    const hot = temperature >= 95;
    temp.classList.toggle("temp--hot", hot);
    if (hot) {
        const intensity = Math.min((temperature - 95) / 25, 1);
        temp.style.setProperty("--heat-amp", (0.3 + intensity * 0.7).toFixed(2) + "px");
        temp.style.setProperty("--heat-speed", (0.5 - intensity * 0.15).toFixed(2) + "s");
    } else {
        temp.style.removeProperty("--heat-amp");
        temp.style.removeProperty("--heat-speed");
    }
}

function renderTodayView(data, isNight) {
    set("cityName", data.city);
    // unit spans let mobile show bare values while desktop keeps 54
    document.getElementById("tempMain").innerHTML =
        `${Math.round(data.temperature)}°<span class="unit">F</span>`;
    applyTempMood(data.temperature);

    const conditionFormatted = data.condition
        .split(" ")
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join(" ");
    const conditionEl = document.getElementById("conditionText");
    const feelsEl = document.getElementById("feelsExplanation");
    const feelsLineEl = document.getElementById("feelsLine");
    const expl = getFeelsLikeExplanation(
        data.temperature, data.feelsLike, data.windSpeed, data.humidity
    );
    if (conditionEl) conditionEl.textContent = conditionFormatted;
    if (feelsEl) {
        feelsEl.textContent = `— ${expl}`;
    }
    if (feelsLineEl) {
        // mobile hero line
        feelsLineEl.textContent =
            `Feels like ${Math.round(data.feelsLike)}° — ${expl.replace(/^Feels\s+/, "")}`;
    }

    document.getElementById("feelsLike").innerHTML =
        `${Math.round(data.feelsLike)}°<span class="unit">F</span>`;
    set("humidity", data.humidity + "%");
    set("wind", Math.round(data.windSpeed) + " mph");
    document.getElementById("windDir").innerHTML =
        `${degreesToCompass(data.windDeg)}<span class="wind-speed-suffix"> ${Math.round(data.windSpeed)} mph</span>`;
    const { time: cityTime } = formatCityNow(data.timezoneOffset);
    set("timestamp", "As of " + cityTime);
    set("timestampMobile", "As of " + cityTime);
    updateHeaderCityVisibility();

    const visibilityMiles = (data.visibility / 1609.34).toFixed(1);
    set("visibility", visibilityMiles + " mi");
    set("cloudCover", data.cloudCover + "%");
    document.getElementById("pressure").innerHTML =
        `${hpaToInHg(data.pressure)} in<span class="unit">Hg</span>`;

    const sunriseTime = formatCityTime(data.sunrise, data.timezoneOffset);
    const sunsetTime = formatCityTime(data.sunset, data.timezoneOffset);
    set("sunrise", sunriseTime);
    set("sunset", sunsetTime);

    const iconKey = isNight ? `${data.conditionId}n` : data.conditionId;
    const iconSrc = "icons/" + (iconMap[iconKey] ?? "default.png");

    const iconEl = document.getElementById("weatherIcon");
    iconEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = data.description;
    img.className = "weather-img";
    iconEl.appendChild(img);
    playAnimation(img, "anim-bounce-once");

    updateGlobe(data.lat, data.lon);
}

CirrusSearchUI.init({ prefersReducedMotionFn: prefersReducedMotion });
CirrusAlerts.init({
    backendUrl: BACKEND_URL,
    show,
    hide,
    set,
    getTimezoneOffset: () => activeTimezoneOffset,
    formatCityTime,
    prefersReducedMotion,
    onAlertsChanged: () => {
        if (currentWeatherConditionId !== null) {
            CirrusAtmosphere.refresh(currentWeatherConditionId);
        }
    },
    allowAutoPop: () => !CirrusForecast.isForecastTabActive(),
});
CirrusForecast.init({
    show,
    hide,
    playAnimation,
    prefersReducedMotion,
    bounceTab,
    withLoading,
    fetchWeatherData,
    fetchForecastData,
    getCachedEntry: (cityKey) => getCachedEntry(clientCache.weather, cityKey),
    normalizeCityKey,
    completeForecastLoad,
    getCurrentConditionId: () => currentWeatherConditionId,
    refreshAtmosphere: (conditionId) => CirrusAtmosphere.refresh(conditionId),
    updateTodayEmptyState,
    activateOnEnterOrSpace,
    formatCityNow,
    getTimezoneOffset: () => activeTimezoneOffset,
    onTodayTabActive: () => CirrusAlerts.syncOverlay(),
});

// Live clock in the mobile dock 
function updateDockClock() {
    const now = new Date();
    set("dockTime", now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    set("dockDate", now.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }));
}
updateDockClock();
setInterval(updateDockClock, 1000);

renderHistory();
updateTodayEmptyState();
updateHeaderCityVisibility();

document.getElementById("cityInput").addEventListener("input", () => {
    updateHistoryFilter();
    updateHeaderCityVisibility();
});
