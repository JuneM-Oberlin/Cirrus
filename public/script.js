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

/* Today ⇄ Forecast window swipe + day-card pop choreography.
   Timings/easings are final per the forecast-animations design handoff. */
const CARD_POP_DELAY_MS = 520;  // let the window swipe land before cards pop
const CARD_STAGGER_MS = 150;    // per-card delay, both in and out
const CARD_SLIDE_PX = 44;       // cards slide in from the left
const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

let activeTab = "today";
let tabSwitchPending = false;   // true while the card pop-out exit is playing
let lastSwipeStart = -Infinity; // performance.now() when the track last slid

function forecastDayCards() {
    return [...document.querySelectorAll("#forecastStrip .forecast-day")];
}

function cancelCardAnimations(card) {
    card.getAnimations().forEach((anim) => anim.cancel());
}

// Hide the cards before the swipe starts so they pop in after the window
// lands instead of flickering through mid-slide.
function hideForecastCards() {
    if (prefersReducedMotion()) {
        return;
    }
    forecastDayCards().forEach((card) => {
        cancelCardAnimations(card);
        card.style.opacity = "0";
    });
}

// Delay that lands the first card pop right as the window swipe settles,
// whether the cards already exist or arrive later from a fetch.
function cardPopBaseDelay() {
    return Math.max(0, CARD_POP_DELAY_MS - (performance.now() - lastSwipeStart));
}

// Day cards pop in one after another, left → right, with a springy overshoot.
function popInForecastCards() {
    const reduced = prefersReducedMotion();
    forecastDayCards().forEach((card, i) => {
        cancelCardAnimations(card);
        card.style.opacity = "";
        if (reduced) {
            return;
        }
        // 'backwards' holds the card invisible through its stagger delay, then
        // releases to natural styles at finish so hover/press transforms work
        card.animate([
            { opacity: 0, transform: `translateX(${-CARD_SLIDE_PX}px) scale(0.84)` },
            { opacity: 1, transform: `translateX(${CARD_SLIDE_PX * 0.14}px) scale(1.05)`, offset: 0.6 },
            { opacity: 1, transform: "translateX(0) scale(1)" },
        ], {
            duration: 540,
            delay: cardPopBaseDelay() + i * CARD_STAGGER_MS,
            easing: SPRING_EASING,
            fill: "backwards",
        });
    });
}

// Reverse exit: rightmost card leaves first, accelerating out. `done` fires
// once the last card is gone so the window swipe can follow.
function popOutForecastCards(done) {
    const cards = forecastDayCards();
    if (!cards.length || prefersReducedMotion()) {
        done();
        return;
    }
    const duration = 380;
    let maxEnd = 0;
    cards.forEach((card, i) => {
        cancelCardAnimations(card);
        const delay = (cards.length - 1 - i) * CARD_STAGGER_MS;
        maxEnd = Math.max(maxEnd, delay + duration);
        card.animate([
            { opacity: 1, transform: "translateX(0) scale(1)" },
            { opacity: 0, transform: `translateX(${-CARD_SLIDE_PX}px) scale(0.84)` },
        ], {
            duration,
            delay,
            easing: "cubic-bezier(0.4, 0, 1, 1)",
            fill: "both",
        });
    });
    setTimeout(done, maxEnd + 20);
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

// A storm-threat alert is a thunderstorm or tornado watch/warning — these
// drive the lightning flashes even when the current condition is calm.
function isStormThreatAlert(alert) {
    if (!alert || !alert.event) {
        return false;
    }
    const event = alert.event.toLowerCase();
    const isWatchOrWarning = alert.tier === "warning" || alert.tier === "watch";
    return isWatchOrWarning
        && (event.includes("thunderstorm") || event.includes("tornado"));
}

function alertsHaveStormThreat() {
    return typeof activeAlerts !== "undefined"
        && activeAlerts.some(isStormThreatAlert);
}

// Pick the strongest lightning profile across the live condition and any
// active storm alerts: tornado or any warning = severe, watch = heavy.
function stormLightningProfile(conditionId) {
    const rank = { none: 0, normal: 0, heavy: 1, severe: 2 };
    let best = typeof thunderIconIntensity === "function"
        ? thunderIconIntensity(conditionId)
        : "none";

    if (typeof activeAlerts !== "undefined") {
        activeAlerts.forEach((alert) => {
            if (!isStormThreatAlert(alert)) {
                return;
            }
            const event = alert.event.toLowerCase();
            const intensity = event.includes("tornado") || alert.tier === "warning"
                ? "severe"
                : "heavy";
            if (rank[intensity] > rank[best]) {
                best = intensity;
            }
        });
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
        && (conditionHasThunder(conditionId) || alertsHaveStormThreat());

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

    // Keep the atmosphere layer alive if EITHER rain or storm-alert lightning
    // is showing, so a tornado warning still flashes under otherwise clear skies.
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
    return activeTab === "forecast";
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

    // Wii-style staggered pop-in when history actually changes (skipped under reduced motion)
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
    if (activeTab === "today"
        && document.getElementById("weatherDisplay").classList.contains("hidden")) {
        show("todayEmpty");
    } else {
        hide("todayEmpty");
    }
}

function presentWeather(data, alertsGen) {
    activeTimezoneOffset = data.timezoneOffset ?? 0;
    currentWeatherConditionId = data.conditionId;
    const isNight = data.weatherCode.endsWith("n");
    document.body.classList.toggle("theme-day", !isNight);
    renderTodayView(data, isNight);
    setWeatherAtmosphere(data.conditionId);
    hide("todayEmpty");
    checkAlerts(data, alertsGen);
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

const searchButton = document.querySelector(".search-row button");

function setSearchButtonSearching(isSearching) {
    if (!searchButton) {
        return;
    }
    searchButton.classList.toggle("is-searching", isSearching);
}

function playSearchPressGlow() {
    if (!searchButton || prefersReducedMotion()) {
        return;
    }
    searchButton.classList.remove("search-press-feedback");
    void searchButton.offsetWidth;
    searchButton.classList.add("search-press-feedback");
}

if (searchButton) {
    searchButton.addEventListener("animationend", (event) => {
        if (event.target !== searchButton || event.animationName !== "searchPressGlow") {
            return;
        }
        searchButton.classList.remove("search-press-feedback");
    });
}

let coldStartTimers = [];

function startColdStartLoading(initialMessage) {
    stopColdStartLoading();
    setSearchButtonSearching(true);
    set("loading", initialMessage);
    show("loading");

    const startedAt = Date.now();
    coldStartTimers.push(setTimeout(() => {
        set("loading", "Waking up the server — first search can take up to a minute…");
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
    setSearchButtonSearching(false);
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
    if (tab === activeTab || tabSwitchPending) {
        return;
    }

    bounceTab(document.getElementById(tab === "today" ? "tabToday" : "tabForecast"));

    if (tab === "forecast") {
        // hide the cards first, then swipe; the pop-in delay lands them
        // on-screen once the window has settled
        hideForecastCards();
        applyTab("forecast");
        popInForecastCards();
        loadForecastIfNeeded();
        return;
    }

    // Back to Today: the reverse pop-out plays first, THEN the window swipes,
    // and the big temperature squash-lands as the Today pane settles.
    tabSwitchPending = true;
    popOutForecastCards(() => {
        tabSwitchPending = false;
        applyTab("today");
        if (!prefersReducedMotion()) {
            setTimeout(() => {
                playAnimation(document.getElementById("tempMain"), "anim-temp-pop");
            }, CARD_POP_DELAY_MS);
        }
    });
}

function applyTab(tab) {
    activeTab = tab;
    const isToday = tab === "today";
    const todayView    = document.getElementById("todayView");
    const forecastView = document.getElementById("forecastView");
    const tabToday     = document.getElementById("tabToday");
    const tabForecast  = document.getElementById("tabForecast");
    const globe        = document.getElementById("globeBg");

    // slide the 200%-wide track like switching windows
    lastSwipeStart = performance.now();
    document.getElementById("viewTrack").classList.toggle("view-track--forecast", !isToday);

    tabToday.classList.toggle("active", isToday);
    tabForecast.classList.toggle("active", !isToday);
    tabToday.setAttribute("aria-selected", String(isToday));
    tabForecast.setAttribute("aria-selected", String(!isToday));
    tabToday.tabIndex = isToday ? 0 : -1;
    tabForecast.tabIndex = isToday ? -1 : 0;

    // both panes stay rendered for the swipe; keep the off-screen one out of
    // the tab order and away from screen readers
    todayView.inert = !isToday;
    todayView.setAttribute("aria-hidden", String(!isToday));
    forecastView.inert = isToday;
    forecastView.setAttribute("aria-hidden", String(isToday));

    if (isToday) {
        updateTodayEmptyState();
        if (currentWeatherConditionId !== null) {
            setWeatherAtmosphere(currentWeatherConditionId);
        }
    } else {
        updateForecastEmptyState();
    }

    if (globe.style.backgroundImage) {
        globe.classList.remove("globe-hidden");
    }
}

function loadForecastIfNeeded() {
    const city = document.getElementById("cityInput").value.trim();
    const strip = document.getElementById("forecastStrip");
    if (!city || strip.innerHTML.trim() !== "") {
        return;
    }

    hide("forecastEmpty");
    hide("errorMsg");
    const alertsGen = beginAlertsCheckForSearch();
    startColdStartLoading("Fetching forecast…");

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
            checkAlerts(weatherData, alertsGen);
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

    // stagger the fresh cards in; if a swipe is mid-flight the shared base
    // delay holds them until the window lands
    popInForecastCards();
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
async function withLoading(task, { revealWeather = true, loadingMessage = "Fetching weather…" } = {}) {
    const alertsGen = beginAlertsCheckForSearch();
    clearWeatherAtmosphere();
    startColdStartLoading(loadingMessage);
    if (revealWeather) {
        hide("weatherDisplay");
    }
    hide("errorMsg");

    try {
        await task(alertsGen);
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

    playSearchPressGlow();

    if (isForecastTabActive()) {
        searchForecast(city);
    } else {
        searchToday(city);
    }
}

function searchToday(city) {
    withLoading(async (alertsGen) => {
        presentWeather(await fetchWeatherData(city), alertsGen);
        addToHistory(city);
    });
}

function searchForecast(city) {
    document.getElementById("forecastStrip").innerHTML = "";
    hideForecastDetails();
    hide("forecastEmpty");

    withLoading(async (alertsGen) => {
        const [weatherData, forecastData] = await Promise.all([
            fetchWeatherData(city),
            fetchForecastData(city),
        ]);
        presentWeather(weatherData, alertsGen);
        set("cityName", formatCityLabel(city));
        updateHeaderCityVisibility();
        renderForecast(forecastData, weatherData.timezoneOffset);
        addToHistory(city);
    }, { revealWeather: false, loadingMessage: "Fetching forecast…" });
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

// Temperature mood on the big number: below freezing it chills from yellow
// to the low-temp cyan and shivers; from 80°F up it shakes harder with heat.
function applyTempMood(temperature) {
    const temp = document.getElementById("tempMain");
    temp.classList.toggle("temp--freezing", temperature < 32);

    const hot = temperature >= 95;
    temp.classList.toggle("temp--hot", hot);
    if (hot) {
        const intensity = Math.min((temperature - 95) / 25, 1); // maxes out at 120°F
        temp.style.setProperty("--heat-amp", (0.3 + intensity * 0.7).toFixed(2) + "px");
        temp.style.setProperty("--heat-speed", (0.5 - intensity * 0.15).toFixed(2) + "s");
    } else {
        temp.style.removeProperty("--heat-amp");
        temp.style.removeProperty("--heat-speed");
    }
}

function renderTodayView(data, isNight) {
    set("cityName", data.city);
    set("tempMain", Math.round(data.temperature) + "°F");
    applyTempMood(data.temperature);

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
        feelsEl.textContent = `— ${expl}`;
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
    updateHistoryFilter();
    updateHeaderCityVisibility();
});

/* =========================================================================
   SEVERE WEATHER ALERTS — Wii HOME Menu overlay
   ========================================================================= */

const ALERT_KNOWN_TIERS = new Set(["warning", "watch", "advisory", "statement"]);
const ALERT_TIER_LABELS = {
    warning: "Warning",
    watch: "Watch",
    advisory: "Advisory",
    statement: "Statement",
    unknown: "Alert",
};

let activeAlerts = [];
let alertLastFocused = null;
let alertAutoPopDismissed = false;
let alertClosing = false;
let alertDetailId = null;
let alertsCheckGeneration = 0;

function beginAlertsCheckForSearch() {
    alertsCheckGeneration += 1;
    hideAlertFetchError();
    alertAutoPopDismissed = false;
    activeAlerts = [];
    updateAlertBadge();
    closeAlertOverlay({ userDismissed: false });
    return alertsCheckGeneration;
}

async function fetchAlerts(lat, lon) {
    if (lat == null || lon == null) {
        return { alerts: [], error: false };
    }
    try {
        const url = `${BACKEND_URL}/alerts?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || data.error) {
            return { alerts: [], error: true };
        }
        const alerts = Array.isArray(data.alerts) ? data.alerts : [];
        return { alerts, error: false };
    } catch (e) {
        console.log("Alerts fetch failed:", e);
        return { alerts: [], error: true };
    }
}

async function checkAlerts(data, generation) {
    const { alerts, error } = await fetchAlerts(data.lat, data.lon);
    if (generation !== alertsCheckGeneration) {
        return;
    }
    activeAlerts = error ? [] : alerts;
    updateAlertBadge();
    // Alerts arrive after presentWeather ran, so re-apply the atmosphere now —
    // an active thunderstorm/tornado watch or warning drives the lightning.
    setWeatherAtmosphere(data.conditionId);

    if (error) {
        showAlertFetchError("Could not load weather alerts. Badge counts may be unavailable.");
        closeAlertOverlay({ userDismissed: false });
        return;
    }

    hideAlertFetchError();

    if (!alerts.length) {
        closeAlertOverlay({ userDismissed: false });
        return;
    }

    refreshAlertOverlayContent();

    const hasAutoPop = alerts.some(shouldAutoPopAlert);
    if (hasAutoPop && !alertAutoPopDismissed) {
        openAlertOverlay();
    }
}

function showAlertFetchError(message) {
    set("alertFetchMsg", message);
    show("alertFetchMsg");
}

function hideAlertFetchError() {
    hide("alertFetchMsg");
}

function isAlertOverlayOpen() {
    const overlay = document.getElementById("alertOverlay");
    return overlay && !overlay.classList.contains("hidden") && !overlay.hidden;
}

function refreshAlertOverlayContent() {
    if (!isAlertOverlayOpen() || !activeAlerts.length) {
        return;
    }
    const preservedId = alertDetailId;
    renderAlertChannels();
    renderAlertStrip();
    updateAlertMenuHeader();
    if (preservedId) {
        const still = activeAlerts.find((alert) => alert.id === preservedId);
        if (still) {
            showAlertDetail(still, { focus: false });
            return;
        }
    }
    hideAlertDetail();
}

function normalizeAlertTier(tier) {
    return ALERT_KNOWN_TIERS.has(tier) ? tier : "unknown";
}

function shouldAutoPopAlert(alert) {
    return alert.autoPop === true;
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

        const tier = normalizeAlertTier(alert.tier);
        const sev = document.createElement("span");
        sev.className = `alert-sev alert-sev--${tier}`;
        sev.textContent = alertTierLabel(tier);

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

        btn.setAttribute("aria-label", `${alertTierLabel(tier)}: ${alert.event}`);
        btn.addEventListener("click", () => showAlertDetail(alert));
        wrap.appendChild(btn);
    });
}

function setAlertCenterDetailMode(active) {
    const center = document.getElementById("alertCenter");
    center?.classList.toggle("alert-center--detail", active);
}

function showAlertDetail(alert, { focus = true } = {}) {
    alertDetailId = alert.id;
    const body = document.getElementById("alertDetailBody");
    body.replaceChildren();

    const title = document.createElement("div");
    title.className = "alert-detail-event";
    title.textContent = alert.event;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "alert-detail-meta";
    const tier = normalizeAlertTier(alert.tier);
    const sev = document.createElement("span");
    sev.className = `alert-sev alert-sev--${tier}`;
    sev.textContent = alertTierLabel(tier);
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
    if (focus) {
        document.getElementById("alertBack").focus();
    }
}

function hideAlertDetail() {
    alertDetailId = null;
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
        badge.setAttribute("data-tier", normalizeAlertTier(activeAlerts[0].tier));
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

    refreshAlertOverlayContent();

    // cancel an in-progress retract if the user reopens mid-close
    alertClosing = false;
    overlay.classList.remove("alert-closing");

    if (wasClosed) {
        alertLastFocused = document.activeElement;
        overlay.classList.remove("hidden");
        overlay.hidden = false;
        document.addEventListener("keydown", onAlertKeydown);
    }
    document.getElementById("alertClose").focus();
}

function finishCloseAlertOverlay(overlay) {
    overlay.classList.remove("alert-closing");
    overlay.classList.add("hidden");
    overlay.hidden = true;
    alertClosing = false;
    document.removeEventListener("keydown", onAlertKeydown);
    updateAlertBadge();
    if (alertLastFocused && typeof alertLastFocused.focus === "function") {
        alertLastFocused.focus();
    }
}

function closeAlertOverlay({ userDismissed = true } = {}) {
    const overlay = document.getElementById("alertOverlay");
    if (overlay.classList.contains("hidden")) {
        return;
    }

    if (userDismissed) {
        alertAutoPopDismissed = true;
    }

    // No animation under reduced motion (or if already retracting) — close now.
    if (prefersReducedMotion() || alertClosing) {
        finishCloseAlertOverlay(overlay);
        return;
    }

    // Play the retract, then hide once the scrim has faded out.
    alertClosing = true;
    overlay.classList.add("alert-closing");

    const onClosed = (event) => {
        if (event.target !== overlay || event.animationName !== "alertScrimOut") {
            return;
        }
        overlay.removeEventListener("animationend", onClosed);
        finishCloseAlertOverlay(overlay);
    };
    overlay.addEventListener("animationend", onClosed);
}

function onAlertKeydown(event) {
    if (event.key === "Escape") {
        closeAlertOverlay();
        return;
    }
    if (event.key !== "Tab") {
        return;
    }
    const menu = document.getElementById("alertOverlay");
    if (!menu) {
        return;
    }
    const focusable = menu.querySelectorAll(
        'button:not([hidden]):not(.hidden), [href], [tabindex]:not([tabindex="-1"])'
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
