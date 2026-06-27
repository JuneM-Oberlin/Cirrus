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

function triggerForecastStripEnter() {
    const strip = document.getElementById("forecastStrip");
    if (!strip || prefersReducedMotion()) {
        return;
    }
    strip.classList.remove("forecast-strip--enter");
    void strip.offsetWidth;
    strip.classList.add("forecast-strip--enter");
    setTimeout(() => strip.classList.remove("forecast-strip--enter"), 900);
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
const FORECAST_HINT_KEY = "cirrus_forecast_hint_dismissed";
const MAX_HISTORY = 8;

let activeTimezoneOffset = 0;
let currentWeatherConditionId = null;

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

function setWeatherAtmosphere(conditionId) {
    const layer = document.getElementById("weatherAtmosphere");
    const globe = document.getElementById("globeBg");
    if (!layer) {
        return;
    }

    const effect = getWeatherEffect(conditionId);
    layer.dataset.effect = effect;

    if (effect === "clear") {
        if (typeof AtmoRainVideo !== "undefined") {
            AtmoRainVideo.stop();
        }
        if (typeof AtmoLightning !== "undefined") {
            AtmoLightning.stop();
        }
        layer.classList.add("is-hidden");
        globe?.classList.remove("atmosphere-active");
        return;
    }

    layer.classList.remove("is-hidden");
    globe?.classList.add("atmosphere-active");

    const rainProfile = VIDEO_RAIN_EFFECTS[effect];
    if (typeof AtmoRainVideo !== "undefined") {
        if (rainProfile) {
            requestAnimationFrame(() => AtmoRainVideo.start(rainProfile));
        } else {
            AtmoRainVideo.stop();
        }
    }

    if (typeof AtmoLightning !== "undefined") {
        if (conditionHasThunder(conditionId)) {
            AtmoLightning.start(conditionId);
        } else {
            AtmoLightning.stop();
        }
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

function isForecastTabActive() {
    return !document.getElementById("forecastView").classList.contains("hidden");
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

function renderHistory() {
    const container = document.getElementById("historyList");
    if (!container) {
        return;
    }

    container.replaceChildren();
    const inputKey = normalizeCityKey(document.getElementById("cityInput").value);
    loadHistory().forEach((city) => {
        if (normalizeCityKey(city) === inputKey) {
            return;
        }
        const chip = document.createElement("span");
        chip.textContent = city;
        chip.setAttribute("role", "button");
        chip.tabIndex = 0;
        chip.addEventListener("click", () => selectHistoryCity(city));
        chip.addEventListener("keydown", (event) =>
            activateOnEnterOrSpace(event, () => selectHistoryCity(city))
        );
        container.appendChild(chip);
    });

    // Wii-style staggered pop-in on (re)render (skipped under reduced motion)
    if (container.children.length && !prefersReducedMotion()) {
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

function selectHistoryCity(city) {
    document.getElementById("cityInput").value = city;
    searchCity();
}

const BACKEND_URL = "https://weatherapp-project-6rms.onrender.com";

// wake the render free-tier backend
// so the first search doesn't suffer
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
    if (!document.getElementById("todayView").classList.contains("hidden")
        && document.getElementById("weatherDisplay").classList.contains("hidden")) {
        show("todayEmpty");
    } else {
        hide("todayEmpty");
    }
}

function presentWeather(data) {
    activeTimezoneOffset = data.timezoneOffset ?? 0;
    currentWeatherConditionId = data.conditionId;
    const isNight = data.weatherCode.endsWith("n");
    document.body.classList.toggle("theme-day", !isNight);
    renderTodayView(data, isNight);
    setWeatherAtmosphere(data.conditionId);
    hide("todayEmpty");
    checkAlerts(data);
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
    set("loading", initialMessage);
    show("loading");

    const startedAt = Date.now();
    coldStartTimers.push(setTimeout(() => {
        set("loading", "Waking up the server — first search can take up to a minute...");
    }, 4000));

    coldStartTimers.push(setTimeout(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        set("loading", `Still connecting… (${elapsed}s)`);
    }, 15000));

    coldStartTimers.push(setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        if (elapsed >= 15) {
            set("loading", `Still connecting… (${elapsed}s)`);
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
}

function dismissForecastHint() {
    hide("forecastHint");
    localStorage.setItem(FORECAST_HINT_KEY, "1");
}

function activateOnEnterOrSpace(event, action) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
    }
}

function onTabKeydown(event, tab) {
    const otherTab = tab === "today" ? "forecast" : "today";
    const otherEl = document.getElementById(tab === "today" ? "tabForecast" : "tabToday");

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        switchTab(otherTab);
        otherEl.focus();
        return;
    }

    activateOnEnterOrSpace(event, () => switchTab(tab));
}

function hasForecastDays() {
    return document.getElementById("forecastStrip").querySelectorAll(".forecast-day").length > 0;
}

function updateForecastEmptyState() {
    const empty = document.getElementById("forecastEmpty");
    if (!empty) {
        return;
    }

    const city = document.getElementById("cityInput").value.trim();
    if (hasForecastDays()) {
        hide("forecastEmpty");
        return;
    }

    if (!city) {
        empty.textContent = "Search a city to see the 5-day forecast.";
        show("forecastEmpty");
        return;
    }

    hide("forecastEmpty");
}

function hideForecastDetails() {
    const panel = document.getElementById("forecastDetails");
    if (!panel) {
        return;
    }
    panel.classList.add("hidden");
    panel.innerHTML = "";
}

function forecastRainIcon(day) {
    const chance = day.rainChance ?? 0;
    if (chance <= 0) {
        return "partly-cloudy-day.png";
    }

    const mapped = iconMap[day.conditionId];
    if (mapped && /rain|thunder|mixed|sleet|snow/.test(mapped)) {
        return mapped;
    }

    return "partly-cloudy-with-rain-day.png";
}

function switchTab(tab) {
    const todayView    = document.getElementById("todayView");
    const forecastView = document.getElementById("forecastView");
    const tabToday     = document.getElementById("tabToday");
    const tabForecast  = document.getElementById("tabForecast");
    const globe        = document.getElementById("globeBg");

    if (tab === "today") {
        todayView.classList.remove("hidden");
        todayView.hidden = false;
        forecastView.classList.add("hidden");
        forecastView.hidden = true;
        tabToday.classList.add("active");
        tabForecast.classList.remove("active");
        tabToday.setAttribute("aria-selected", "true");
        tabForecast.setAttribute("aria-selected", "false");
        tabToday.tabIndex = 0;
        tabForecast.tabIndex = -1;
        updateTodayEmptyState();
        if (currentWeatherConditionId !== null) {
            setWeatherAtmosphere(currentWeatherConditionId);
        }
    } else {
        forecastView.classList.remove("hidden");
        forecastView.hidden = false;
        todayView.classList.add("hidden");
        todayView.hidden = true;
        tabForecast.classList.add("active");
        tabToday.classList.remove("active");
        tabToday.setAttribute("aria-selected", "false");
        tabForecast.setAttribute("aria-selected", "true");
        tabToday.tabIndex = -1;
        tabForecast.tabIndex = 0;

        const city = document.getElementById("cityInput").value.trim();
        const strip = document.getElementById("forecastStrip");
        updateForecastEmptyState();

        if (city && strip.innerHTML.trim() === "") {
            hide("forecastEmpty");
            hide("errorMsg");
            startColdStartLoading("Fetching forecast...");

            const cityKey = normalizeCityKey(city);
            const cachedWeather = getCachedEntry(clientCache.weather, cityKey);
            const weatherPromise = cachedWeather
                ? Promise.resolve(cachedWeather)
                : fetchWeatherData(city);

            Promise.all([fetchForecastData(city), weatherPromise])
                .then(([forecastData, weatherData]) => {
                    activeTimezoneOffset = weatherData.timezoneOffset ?? 0;
                    currentWeatherConditionId = weatherData.conditionId;
                    set("cityName", formatCityLabel(city));
                    updateHeaderCityVisibility();
                    document.body.classList.toggle(
                        "theme-day",
                        !weatherData.weatherCode.endsWith("n")
                    );
                    setWeatherAtmosphere(weatherData.conditionId);
                    updateGlobe(weatherData.lat, weatherData.lon);
                    renderForecast(forecastData, activeTimezoneOffset);
                    checkAlerts(weatherData);
                    addToHistory(city);
                })
                .catch((err) => {
                    console.log("Forecast error:", err);
                    showError(err.message || "Could not load forecast.");
                    updateForecastEmptyState();
                })
                .finally(() => {
                    stopColdStartLoading();
                    hide("loading");
                });
        }
    }

    const isToday = tab === "today";
    tabToday.setAttribute("tabindex", isToday ? "0" : "-1");
    tabForecast.setAttribute("tabindex", isToday ? "-1" : "0");

    bounceTab(isToday ? tabToday : tabForecast);

    if (globe.style.backgroundImage) {
        globe.classList.remove("globe-hidden");
    }
}

function renderForecast(days, timezoneOffset = activeTimezoneOffset) {
    const strip = document.getElementById("forecastStrip");
    const footer = document.getElementById("forecastFooter");
    const { time: timeText, date: dateText } = formatCityNow(timezoneOffset);

    footer.textContent = `As of ${timeText}, ${dateText}`;

    strip.innerHTML = days.map((day, i) => {
        const iconKey = day.conditionId;
        const rainIcon = forecastRainIcon(day);
        const rainAlt = (day.rainChance ?? 0) > 0
            ? `${day.rainChance}% chance of rain`
            : "No rain expected";
        return `
    <div class="forecast-day glass-panel" role="button" tabindex="0" aria-label="${day.day} forecast">
      <div class="forecast-label ${i === 0 ? 'today' : ''}">${day.day}</div>
      <img class="forecast-icon"
           src="icons/${iconMap[iconKey] ?? "default.png"}"
           alt="${day.condition}">
      <div class="forecast-high">${Math.round(day.high)}°F</div>
      <div class="forecast-low">${Math.round(day.low)}°F</div>
      <div class="forecast-rain">
        <img class="rain-icon" src="icons/${rainIcon}" alt="${rainAlt}">
        ${day.rainChance}%
      </div>
    </div>
  `;
    }).join("");

    hide("forecastEmpty");

    if (!localStorage.getItem(FORECAST_HINT_KEY)) {
        show("forecastHint");
    }

    const dayEls = strip.querySelectorAll(".forecast-day");
    dayEls.forEach((el, idx) => {
        const selectDay = () => {
            dismissForecastHint();
            dayEls.forEach((d) => d.classList.remove("active"));
            el.classList.add("active");
            showForecastDetails(days[idx]);
        };
        el.addEventListener("click", selectDay);
        el.addEventListener("keydown", (event) => activateOnEnterOrSpace(event, selectDay));
    });

    triggerForecastStripEnter();
}

function showForecastDetails(day) {
    const panel = document.getElementById('forecastDetails');
    if (!panel) return;

    const description = day.description || day.condition || '';
    const rain = (day.rainChance !== undefined) ? `${day.rainChance}%` : '—';
    // backend sends daily precip volume in mm; display imperial like the rest of the app
    const precipInches = (day.precipitation ?? 0) / 25.4;
    const precip = precipInches > 0 ? `${precipInches.toFixed(2)} in` : '0 in';
    const wind = (day.windSpeed !== undefined) ? `${Math.round(day.windSpeed)} mph` : '—';

    panel.innerHTML = `
        <div class="details-card glass-panel">
            <div class="details-left">
                <div class="details-day">${day.day}</div>
                <div class="details-desc">${description}</div>
            </div>
            <div class="details-right">
                <div class="details-row"><span class="k">High:</span> <span class="v">${Math.round(day.high)}°</span></div>
                <div class="details-row"><span class="k">Low:</span> <span class="v">${Math.round(day.low)}°</span></div>
                <div class="details-row"><span class="k">Precip:</span> <span class="v">${precip}</span></div>
                <div class="details-row"><span class="k">Rain:</span> <span class="v">${rain}</span></div>
                <div class="details-row"><span class="k">Wind:</span> <span class="v">${wind}</span></div>
            </div>
        </div>
    `;
    panel.classList.remove('hidden');
    const card = panel.querySelector(".details-card");
    playAnimation(card, "anim-pop");
    if (day.conditionId !== undefined) {
        setWeatherAtmosphere(day.conditionId);
    }
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// shared loading/error choreography for both search paths
async function withLoading(task, { revealWeather = true, loadingMessage = "Fetching weather..." } = {}) {
    clearWeatherAtmosphere();
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
        if (isForecastTabActive()) {
            updateForecastEmptyState();
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

    if (isForecastTabActive()) {
        searchForecast(city);
    } else {
        searchToday(city);
    }
}

function searchToday(city) {
    withLoading(async () => {
        presentWeather(await fetchWeatherData(city));
        addToHistory(city);
    });
}

function searchForecast(city) {
    document.getElementById("forecastStrip").innerHTML = "";
    hideForecastDetails();
    hide("forecastEmpty");

    withLoading(async () => {
        const [weatherData, forecastData] = await Promise.all([
            fetchWeatherData(city),
            fetchForecastData(city),
        ]);
        presentWeather(weatherData);
        set("cityName", formatCityLabel(city));
        updateHeaderCityVisibility();
        renderForecast(forecastData, weatherData.timezoneOffset);
        addToHistory(city);
    }, { revealWeather: false, loadingMessage: "Fetching forecast..." });
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

function renderTodayView(data, isNight) {
    set("cityName", data.city);
    set("tempMain", Math.round(data.temperature) + "°F");

    const conditionFormatted = data.condition
        .split(" ")
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join(" ");
    const conditionEl = document.getElementById("conditionText");
    const feelsEl = document.getElementById("feelsExplanation");
    if (conditionEl) conditionEl.textContent = conditionFormatted;
    if (feelsEl) {
        const expl = getFeelsLikeExplanation(
            data.temperature, data.feelsLike, data.windSpeed, data.humidity
        );
        feelsEl.textContent = ` — ${expl}`;
    }

    set("feelsLike", Math.round(data.feelsLike) + "°F");
    set("humidity", data.humidity + "%");
    set("wind", Math.round(data.windSpeed) + " mph");
    set("windDir", degreesToCompass(data.windDeg) + " " + Math.round(data.windSpeed) + " mph");
    const { time: cityTime } = formatCityNow(data.timezoneOffset);
    set("timestamp", "As of " + cityTime);
    updateHeaderCityVisibility();

    const visibilityMiles = (data.visibility / 1609.34).toFixed(1);
    set("visibility", visibilityMiles + " mi");
    set("cloudCover", data.cloudCover + "%");
    set("pressure", hpaToInHg(data.pressure) + " inHg");

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

renderHistory();
updateTodayEmptyState();
updateHeaderCityVisibility();

document.getElementById("cityInput").addEventListener("input", () => {
    renderHistory();
    updateHeaderCityVisibility();
});

/* =========================================================================
   SEVERE WEATHER ALERTS — Wii HOME Menu overlay
   ========================================================================= */

const ALERT_AUTO_POP_TIERS = new Set(["warning", "watch"]);
const ALERT_TIER_LABELS = {
    warning: "Warning",
    watch: "Watch",
    advisory: "Advisory",
    statement: "Statement",
};

let activeAlerts = [];
let alertLastFocused = null;

async function fetchAlerts(lat, lon) {
    if (lat == null || lon == null) {
        return [];
    }
    try {
        const url = `${BACKEND_URL}/alerts?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
        const response = await fetch(url);
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        return Array.isArray(data.alerts) ? data.alerts : [];
    } catch (e) {
        console.log("Alerts fetch failed:", e);
        return [];
    }
}

async function checkAlerts(data) {
    const alerts = await fetchAlerts(data.lat, data.lon);
    activeAlerts = alerts;
    updateAlertBadge();
    if (!alerts.length) {
        closeAlertOverlay();
        return;
    }
    const hasSevere = alerts.some((a) => ALERT_AUTO_POP_TIERS.has(a.tier));
    if (hasSevere) {
        openAlertOverlay();
    }
}

function alertTierLabel(tier) {
    return ALERT_TIER_LABELS[tier] || "Alert";
}

function alertShortEvent(event) {
    return event.replace(/\s+(Warning|Watch|Advisory|Statement)$/i, "").trim() || event;
}

function alertUntilText(alert) {
    const epoch = alert.ends > 0 ? alert.ends : alert.expires;
    if (!epoch) {
        return "";
    }
    return "Until " + formatCityTime(epoch, activeTimezoneOffset);
}

function renderAlertChannels() {
    const wrap = document.getElementById("alertChannels");
    wrap.replaceChildren();

    activeAlerts.forEach((alert) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill alert-channel";

        const sev = document.createElement("span");
        sev.className = `alert-sev alert-sev--${alert.tier}`;
        sev.textContent = alertTierLabel(alert.tier);

        const event = document.createElement("span");
        event.className = "alert-ch-event";
        event.textContent = alertShortEvent(alert.event);

        btn.appendChild(sev);
        btn.appendChild(event);

        const until = alertUntilText(alert);
        if (until) {
            const untilEl = document.createElement("span");
            untilEl.className = "alert-ch-until";
            untilEl.textContent = until;
            btn.appendChild(untilEl);
        }

        btn.addEventListener("click", () => showAlertDetail(alert));
        wrap.appendChild(btn);
    });
}

function setAlertCenterDetailMode(active) {
    const center = document.getElementById("alertCenter");
    center?.classList.toggle("alert-center--detail", active);
}

function showAlertDetail(alert) {
    const body = document.getElementById("alertDetailBody");
    body.replaceChildren();

    const title = document.createElement("div");
    title.className = "alert-detail-event";
    title.textContent = alert.event;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "alert-detail-meta";
    const sev = document.createElement("span");
    sev.className = `alert-sev alert-sev--${alert.tier}`;
    sev.textContent = alertTierLabel(alert.tier);
    meta.appendChild(sev);
    const until = alertUntilText(alert);
    if (until) {
        const u = document.createElement("span");
        u.textContent = until;
        meta.appendChild(u);
    }
    body.appendChild(meta);

    if (alert.senderName) {
        const office = document.createElement("div");
        office.className = "alert-detail-office";
        office.textContent = alert.senderName;
        body.appendChild(office);
    }

    if (alert.description) {
        const desc = document.createElement("div");
        desc.className = "alert-detail-desc";
        desc.textContent = alert.description;
        body.appendChild(desc);
    }

    if (alert.instruction) {
        const instr = document.createElement("div");
        instr.className = "alert-detail-instruction";
        instr.textContent = alert.instruction;
        body.appendChild(instr);
    }

    // bottom bar stays visible — it's persistent chrome
    document.getElementById("alertChannels").classList.add("hidden");
    const detail = document.getElementById("alertDetail");
    detail.classList.remove("hidden");
    detail.hidden = false;
    setAlertCenterDetailMode(true);
    document.getElementById("alertBack").focus();
}

function hideAlertDetail() {
    const detail = document.getElementById("alertDetail");
    detail.classList.add("hidden");
    detail.hidden = true;
    setAlertCenterDetailMode(false);
    document.getElementById("alertChannels").classList.remove("hidden");
}

const ALERT_SEG_ICONS = {
    pin: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    alert: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 22 20 2 20Z"/><rect x="11" y="9" width="2" height="6" rx="1" fill="#0c3247"/><rect x="11" y="16" width="2" height="2" rx="1" fill="#0c3247"/></svg>',
    clock: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    source: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

function makeAlertSeg(iconName) {
    const seg = document.createElement("div");
    seg.className = "alert-seg";
    const svg = ALERT_SEG_ICONS[iconName];
    if (svg) {
        const ic = document.createElement("span");
        ic.style.display = "inline-flex";
        ic.innerHTML = svg; // static markup, no user data
        seg.appendChild(ic);
    }
    return seg;
}

function appendAlertSegText(seg, text, bold) {
    if (bold) {
        const b = document.createElement("b");
        b.textContent = text;
        seg.appendChild(b);
    } else {
        seg.appendChild(document.createTextNode(text));
    }
}

function renderAlertStrip() {
    const strip = document.getElementById("alertStrip");
    strip.replaceChildren();

    const first = activeAlerts[0] || {};
    const county = first.areaDesc ? first.areaDesc.split(";")[0].trim() : "Your area";
    const count = activeAlerts.length;
    const until = alertUntilText(first);

    const segCounty = makeAlertSeg("pin");
    appendAlertSegText(segCounty, county, true);
    strip.appendChild(segCounty);

    const segCount = makeAlertSeg("alert");
    appendAlertSegText(segCount, String(count), true);
    appendAlertSegText(segCount, count === 1 ? " alert" : " alerts", false);
    strip.appendChild(segCount);

    const segUntil = makeAlertSeg("clock");
    appendAlertSegText(segUntil, until || "In effect", false);
    strip.appendChild(segUntil);

    const segSource = makeAlertSeg("source");
    appendAlertSegText(segSource, "NWS", true);
    strip.appendChild(segSource);
}

function updateAlertMenuHeader() {
    const sub = document.getElementById("alertMenuSub");
    const n = activeAlerts.length;
    sub.textContent = `${n} active alert${n === 1 ? "" : "s"}`;
}

function updateAlertBadge() {
    const badge = document.getElementById("alertBadge");
    if (!badge) {
        return;
    }
    if (activeAlerts.length > 0) {
        document.getElementById("alertBadgeCount").textContent = activeAlerts.length;
        badge.setAttribute("data-tier", activeAlerts[0].tier);
        badge.classList.remove("hidden");
        badge.hidden = false;
    } else {
        badge.classList.add("hidden");
        badge.hidden = true;
    }
}

function openAlertOverlay() {
    if (!activeAlerts.length) {
        return;
    }
    const overlay = document.getElementById("alertOverlay");
    const wasClosed = overlay.classList.contains("hidden");

    renderAlertChannels();
    renderAlertStrip();
    updateAlertMenuHeader();
    hideAlertDetail();

    if (wasClosed) {
        alertLastFocused = document.activeElement;
        overlay.classList.remove("hidden");
        overlay.hidden = false;
        document.addEventListener("keydown", onAlertKeydown);
    }
    document.getElementById("alertClose").focus();
}

function closeAlertOverlay() {
    const overlay = document.getElementById("alertOverlay");
    overlay.classList.add("hidden");
    overlay.hidden = true;
    document.removeEventListener("keydown", onAlertKeydown);
    updateAlertBadge();
    if (alertLastFocused && typeof alertLastFocused.focus === "function") {
        alertLastFocused.focus();
    }
}

function onAlertKeydown(event) {
    if (event.key === "Escape") {
        closeAlertOverlay();
        return;
    }
    if (event.key !== "Tab") {
        return;
    }
    const menu = document.querySelector(".alert-menu");
    const focusable = menu.querySelectorAll(
        'button:not([hidden]), [href], [tabindex]:not([tabindex="-1"])'
    );
    const visible = [...focusable].filter((el) => el.offsetParent !== null);
    if (!visible.length) {
        return;
    }
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

(function wireAlertControls() {
    const close = document.getElementById("alertClose");
    const back = document.getElementById("alertBack");
    if (close) {
        close.addEventListener("click", closeAlertOverlay);
    }
    if (back) {
        back.addEventListener("click", () => {
            hideAlertDetail();
            document.getElementById("alertClose").focus();
        });
    }
})();
