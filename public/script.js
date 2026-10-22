// App glue: fetching, caching, loading/error states, recent cities, and
// wiring the frame, views, search, alerts, and desktop Home together.

function show(id) {document.getElementById(id).classList.remove("hidden");}
function hide(id) {document.getElementById(id).classList.add("hidden");}
function set(id, value) {document.getElementById(id).textContent = value;}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDesktop() {
    return window.matchMedia("(min-width: 768px)").matches;
}

/* ---------- Recent cities ---------- */

const HISTORY_KEY = "cirrus_city_history";
const MAX_HISTORY = 8;

function normalizeCityKey(city) {
    return (city || "").trim().toLowerCase();
}

function loadHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    } catch (err) {
        console.log("Could not load search history:", err);
        return [];
    }
}

function saveHistory(cities) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(cities));
    } catch (err) {
        console.log("Could not save search history:", err);
    }
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
    CirrusSearch.renderRecents();
}

/* ---------- Backend access ---------- */

// GitHub Pages serves only static files (no backend), so point it at the hosted API.
// Anywhere else (the Java server, localhost), the app's own server handles the API.
let BACKEND_URL = "";
if (location.hostname.endsWith(".github.io")) {
    BACKEND_URL = "https://cirrus-project1.duckdns.org";
}

// Wake the (possibly sleeping) free-tier server as early as possible.
// fallow-ignore-next-line security-sink -- BACKEND_URL is same-origin or the pinned HTTPS API, and /health is a fixed path.
fetch(`${BACKEND_URL}/health`).catch(() => {});

const clientCache = {
    weather: new Map(),
    forecast: new Map(),
    sixHour: new Map(),
    uv: new Map(),
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

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
    let description = data.description;
    if (!description) {
        description = data.condition;
    }
    let timezoneOffset = data.timezoneOffset;
    if (timezoneOffset === undefined || timezoneOffset === null) {
        timezoneOffset = 0;
    }
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
        description: description,
        visibility: data.visibility,
        cloudCover: data.cloudCover,
        pressure: data.pressure,
        sunrise: data.sunrise,
        sunset: data.sunset,
        tempMin: data.tempMin,
        tempMax: data.tempMax,
        lat: data.lat,
        lon: data.lon,
        timezoneOffset: timezoneOffset,
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
        if (err.error) {
            errorMessage = err.error;
        }
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
        // fallow-ignore-next-line security-sink -- callers pass only fixed endpoint names, and the city query value is percent-encoded.
        response = await fetch(`${BACKEND_URL}/${path}?city=${encodeURIComponent(city)}`);
    } catch (fetchError) {
        throw new Error(networkErrorMessage());
    }

    if (!response.ok) {
        const error = new Error(await readBackendError(response));
        error.status = response.status;
        throw error;
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

// The 6-hour view is a bonus: if it fails, the rest of the city still loads.
function fetchSixHourData(city) {
    return fetchCached("sixhour", city, clientCache.sixHour).catch((err) => {
        console.log("6-hour forecast unavailable:", err);
        return null;
    });
}

// UV comes from OpenWeather's deprecated UV service, so a failure only
// means "UV data unavailable" (null), never a broken page.
async function fetchUvData(lat, lon) {
    const key = lat.toFixed(2) + "," + lon.toFixed(2);
    const cached = getCachedEntry(clientCache.uv, key);
    if (cached) {
        return cached;
    }
    try {
        // fallow-ignore-next-line security-sink -- fixed /uv path with numeric, percent-encoded coordinates.
        const response = await fetch(`${BACKEND_URL}/uv?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        setCachedEntry(clientCache.uv, key, data);
        return data;
    } catch (err) {
        console.log("UV unavailable:", err);
        return null;
    }
}

// One region of globe markers; the server caps and caches upstream calls.
async function fetchGlobeRegion(regionId) {
    // fallow-ignore-next-line security-sink -- fixed /globe path; the region id comes from a fixed list and is percent-encoded.
    const response = await fetch(`${BACKEND_URL}/globe?region=${encodeURIComponent(regionId)}`);
    if (!response.ok) {
        throw new Error(await readBackendError(response));
    }
    return response.json();
}

/* ---------- Loading + error status ---------- */

let coldStartTimers = [];

// What the last failed load was, so "Try again" knows what to do.
let lastFailure = null;

function setLoadingText(message) {
    set("loadingText", message);
    set("homeStatus", message);
}

function showError(message) {
    set("errorMsg", message);
    show("errorCard");
    const homeStatus = document.getElementById("homeStatus");
    homeStatus.textContent = message;
    homeStatus.classList.add("home-status--error");
    homeStatus.classList.remove("hidden");
}

function hideError() {
    hide("errorCard");
}

// A misspelled town goes back to the search field; anything else retries.
function retryAfterError() {
    const failure = lastFailure;
    clearStatus();
    if (!failure || failure.status === 404 || !failure.retry) {
        CirrusSearch.retype();
        return;
    }
    failure.retry();
}

function clearStatus() {
    hide("loading");
    hideError();
    const homeStatus = document.getElementById("homeStatus");
    homeStatus.classList.add("hidden");
    homeStatus.classList.remove("home-status--error");
}

function startColdStartLoading(initialMessage) {
    stopColdStartLoading();
    document.body.classList.add("is-loading");
    CirrusDesktopChannels.setSearching(true);
    setLoadingText(initialMessage);
    show("loading");
    show("homeStatus");

    const startedAt = Date.now();
    coldStartTimers.push(setTimeout(() => {
        setLoadingText("Waking up the server — first search can take up to a minute");
    }, 4000));

    coldStartTimers.push(setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        if (elapsed >= 15 && elapsed < 30) {
            setLoadingText(`Still connecting (${elapsed}s)`);
        }
    }, 1000));

    coldStartTimers.push(setTimeout(() => {
        setLoadingText("Almost there — free-tier servers can be slow on cold start.");
    }, 30000));
}

function stopColdStartLoading() {
    coldStartTimers.forEach((timerId) => {
        clearTimeout(timerId);
        clearInterval(timerId);
    });
    coldStartTimers = [];
    document.body.classList.remove("is-loading");
    CirrusDesktopChannels.setSearching(false);
}

// Runs a fetch task with the panel loader showing. Resolves true on success.
// retry is what "Try again" runs if this load fails for a reason other than
// a city that doesn't exist.
async function withLoading(task, { loadingMessage = "Fetching weather", retry = null } = {}) {
    clearStatus();
    startColdStartLoading(loadingMessage);
    let ok = false;
    try {
        await task();
        ok = true;
        lastFailure = null;
    } catch (err) {
        console.log("Search error:", err);
        let message = err.message;
        if (!message) {
            message = "Could not load weather data.";
        }
        lastFailure = { status: err.status, retry };
        showError(message);
    } finally {
        stopColdStartLoading();
        hide("loading");
        if (ok) {
            hide("homeStatus");
        }
    }
    return ok;
}

/* ---------- Satellite imagery (NASA GIBS) ---------- */

function gibsImageUrl(lat, lon) {
    const spread = 18;
    const minLon = Math.max(lon - spread, -180);
    const maxLon = Math.min(lon + spread, 180);
    const minLat = Math.max(lat - spread / 2, -90);
    const maxLat = Math.min(lat + spread / 2, 90);

    return [
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        "?SERVICE=WMS",
        "&VERSION=1.1.1",
        "&REQUEST=GetMap",
        "&LAYERS=BlueMarble_ShadedRelief_Bathymetry",
        "&FORMAT=image/jpeg",
        "&TRANSPARENT=false",
        "&WIDTH=1024",
        "&HEIGHT=512",
        "&SRS=EPSG:4326",
        `&BBOX=${minLon},${minLat},${maxLon},${maxLat}`,
    ].join("");
}

function updateGlobe(lat, lon) {
    const nasaUrl = gibsImageUrl(lat, lon);
    const globe = document.getElementById("globeBg");
    const panelSat = document.getElementById("panelSat");

    // Preload so the imagery fades in whole instead of painting in strips.
    const img = new Image();
    img.onload = () => {
        globe.style.backgroundImage = `url('${nasaUrl}')`;
        globe.classList.remove("globe-hidden");
        panelSat.style.backgroundImage = `url('${nasaUrl}')`;
        panelSat.classList.remove("is-empty");
    };
    img.onerror = () => {
        globe.classList.add("globe-hidden");
        panelSat.classList.add("is-empty");
    };
    img.src = nasaUrl;
}

/* ---------- Loading a city ---------- */

const appState = {
    city: "",
    homeCity: "",
    weather: null,
    forecast: [],
    sixHour: null,
    uv: undefined,
    loadedAt: 0,
};

function applyCity(city, weather, forecast, sixHour, { visit = false } = {}) {
    appState.city = city;
    appState.weather = weather;
    appState.forecast = forecast;
    appState.sixHour = sixHour;
    appState.uv = undefined;
    appState.loadedAt = Date.now();

    document.body.classList.toggle("theme-day", !weather.weatherCode.endsWith("n"));
    CirrusSearch.setLocation(weather.city);
    CirrusViews.render(appState);
    CirrusAtmosphere.refresh(weather.conditionId);
    updateGlobe(weather.lat, weather.lon);
    CirrusAlerts.checkAlerts(weather);
    if (!visit) {
        appState.homeCity = city;
        CirrusFrame.setVisiting(false);
        addToHistory(city);
    }
    if (Array.isArray(forecast) && forecast.length >= 5) {
        CirrusDesktopChannels.render(weather, forecast);
    }

    // UV needs the city's coordinates, so it arrives just after the rest.
    fetchUvData(weather.lat, weather.lon).then((uv) => {
        if (appState.weather === weather) {
            appState.uv = uv;
            CirrusViews.renderUv(uv);
        }
    });
}

// options: { visit, retry } — retry replaces the default "load it again".
async function loadCity(city, options = {}) {
    const trimmed = city.trim();
    if (!trimmed) {
        return false;
    }
    let retry = options.retry;
    if (!retry) {
        retry = () => loadCity(trimmed, options);
    }
    CirrusAlerts.resetForSearch();
    return withLoading(async () => {
        const [weather, forecast, sixHour] = await Promise.all([
            fetchWeatherData(trimmed),
            fetchForecastData(trimmed),
            fetchSixHourData(trimmed),
        ]);
        applyCity(trimmed, weather, forecast, sixHour, options);
    }, { retry });
}

// Search from the location pill or a recent-city button.
async function searchCity(city) {
    const ok = await loadCity(city, { retry: () => searchCity(city) });
    if (ok && CirrusSearch.isOpen()) {
        CirrusSearch.close();
        CirrusFrame.showView("current");
    }
}

/* ---------- Globe visits ---------- */

function openGlobe(options = {}) {
    let lat = 38;
    let lon = -100;
    if (appState.weather) {
        lat = appState.weather.lat;
        lon = appState.weather.lon;
    }
    CirrusGlobe.open(Object.assign({ lat, lon }, options));
}

// Choosing a city on the globe shows its views; Back returns to the globe.
async function visitCity(name) {
    const ok = await loadCity(name, { visit: true, retry: () => visitCity(name) });
    if (ok) {
        CirrusGlobe.closeForVisit();
        CirrusFrame.setVisiting(true);
        CirrusFrame.showView("current");
    }
}

// End leaves the globe; after a visit, your own city comes back.
function endGlobe() {
    const wasVisiting = appState.homeCity && normalizeCityKey(appState.city) !== normalizeCityKey(appState.homeCity);
    CirrusFrame.setVisiting(false);
    if (wasVisiting) {
        loadCity(appState.homeCity);
    }
    CirrusFrame.showView("current");
}

/* ---------- Desktop Home ---------- */

function openHome() {
    document.body.classList.add("is-home");
}

function closeHome() {
    document.body.classList.remove("is-home");
}

// Home tiles open the frame at the matching view.
function openChannel(target) {
    closeHome();
    if (target === "today") {
        CirrusFrame.showView("current");
    } else if (target === 0) {
        CirrusFrame.showView("today");
    } else if (target === 1) {
        CirrusFrame.showView("tomorrow");
    } else {
        CirrusFrame.showView("fiveday");
        CirrusViews.openDay(target);
    }
    // a severe alert that arrived while on Home opens now
    CirrusAlerts.sync();
}

/* ---------- Start up ---------- */

CirrusFeel.init();
CirrusFrame.init({
    onHome: openHome,
    prefersReducedMotion,
});
CirrusViews.init({ frame: CirrusFrame, units: CirrusUnits });
CirrusSearch.init({
    frame: CirrusFrame,
    onSearch: searchCity,
    getRecents: loadHistory,
});
CirrusAlerts.init({
    backendUrl: BACKEND_URL,
    frame: CirrusFrame,
    show,
    hide,
    set,
    getTimezoneOffset: () => {
        if (appState.weather) {
            return appState.weather.timezoneOffset;
        }
        return 0;
    },
    formatCityTime: (unixSeconds, offset) => CirrusUnits.cityClockTime(unixSeconds, offset),
    onAlertsChanged: () => {
        if (appState.weather) {
            CirrusAtmosphere.refresh(appState.weather.conditionId);
        }
    },
    // Severe alerts open by themselves only when the frame is on screen.
    allowAutoPop: () => {
        if (CirrusSearch.isOpen()) {
            return false;
        }
        return !(isDesktop() && document.body.classList.contains("is-home"));
    },
    onBadgeOpen: () => {
        closeHome();
        CirrusAlerts.open();
    },
});
CirrusSettings.init({ frame: CirrusFrame, units: CirrusUnits });
CirrusGlobe.init({
    frame: CirrusFrame,
    fetchRegion: fetchGlobeRegion,
    onOpen: () => openGlobe(),
    onVisit: visitCity,
    onEnd: endGlobe,
    formatTemp: (fahrenheit) => CirrusUnits.temp(fahrenheit),
    iconPath: (conditionId, weatherCode) => CirrusViews.iconPath(conditionId, weatherCode),
    prefersReducedMotion,
});
CirrusFrame.setHandlers({
    onEndVisit: () => openGlobe({ keepCamera: true }),
});

// New units re-render everything already on screen.
CirrusUnits.onChange(() => {
    if (!appState.weather) {
        return;
    }
    CirrusViews.render(appState);
    if (Array.isArray(appState.forecast) && appState.forecast.length >= 5) {
        CirrusDesktopChannels.render(appState.weather, appState.forecast);
    }
});

CirrusDesktopChannels.init({
    formatTemp: (fahrenheit) => CirrusUnits.temp(fahrenheit),
    formatAsOf: (weather) => CirrusUnits.asOf(appState.loadedAt, weather.timezoneOffset),
    onSearch: (city) => loadCity(city),
    onOpenChannel: openChannel,
});

document.getElementById("errorRetry").addEventListener("click", retryAfterError);
// typing a new spelling clears the old error
document.getElementById("cityInput").addEventListener("input", hideError);

CirrusViews.showEmpty();
CirrusSearch.renderRecents();
if (isDesktop()) {
    openHome();
}

const startupRecents = loadHistory();
if (startupRecents.length > 0) {
    loadCity(startupRecents[0]);
} else if (!isDesktop()) {
    CirrusSearch.open();
}
