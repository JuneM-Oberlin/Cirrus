//helper show or hide id
function show(id) {document.getElementById(id).classList.remove("hidden");}
function hide(id) {document.getElementById(id).classList.add("hidden");}
function set(id, value) {document.getElementById(id).textContent = value;}

const HISTORY_KEY = "cirrus_city_history";
const MAX_HISTORY = 8;

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
    loadHistory().forEach((city) => {
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
    };
}

async function readBackendError(response) {
    let errorMessage = "Something went wrong.";
    try {
        const err = await response.json();
        errorMessage = err.error || errorMessage;
    } catch (parseError) {
        console.log("Could not parse backend error response:", parseError);
    }
    if (response.status === 429) {
        errorMessage = "Too many searches — please wait a minute.";
    }
    return errorMessage;
}

async function fetchCached(path, city, cache, normalize = (d) => d) {
    const key = normalizeCityKey(city);
    const cached = getCachedEntry(cache, key);
    if (cached) {
        return cached;
    }

    const response = await fetch(`${BACKEND_URL}/${path}?city=${encodeURIComponent(city)}`);
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

function presentWeather(data) {
    const isNight = data.weatherCode.endsWith("n");
    document.body.classList.toggle("theme-day", !isNight);
    renderTodayView(data, isNight);
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
        forecastView.classList.add("hidden");
        tabToday.classList.add("active");
        tabForecast.classList.remove("active");
        tabToday.setAttribute("aria-selected", "true");
        tabForecast.setAttribute("aria-selected", "false");
    } else {
        forecastView.classList.remove("hidden");
        todayView.classList.add("hidden");
        tabForecast.classList.add("active");
        tabToday.classList.remove("active");
        tabToday.setAttribute("aria-selected", "false");
        tabForecast.setAttribute("aria-selected", "true");

        const city = document.getElementById("cityInput").value.trim();
        const strip = document.getElementById("forecastStrip");
        updateForecastEmptyState();

        if (city && strip.innerHTML.trim() === "") {
            hide("forecastEmpty");
            set("loading", "Fetching forecast...");
            show("loading");
            hide("errorMsg");
            fetchForecastData(city)
                .then((data) => {
                    hide("loading");
                    set("cityName", formatCityLabel(city));
                    renderForecast(data);
                    addToHistory(city);
                })
                .catch((err) => {
                    hide("loading");
                    console.log("Forecast error:", err);
                    set("errorMsg", err.message || "Could not load forecast.");
                    show("errorMsg");
                    updateForecastEmptyState();
                });
        }
    }

    const isToday = tab === "today";
    tabToday.setAttribute("tabindex", isToday ? "0" : "-1");
    tabForecast.setAttribute("tabindex", isToday ? "-1" : "0");

    if (globe.style.backgroundImage) {
        globe.classList.remove("globe-hidden");
    }
}

function renderForecast(days) {
    const strip = document.getElementById("forecastStrip");
    const footer = document.getElementById("forecastFooter");
    const now = new Date();
    const timeText = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    const dateText = now.toLocaleDateString([], {
        month: "2-digit",
        day: "2-digit"
    });

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
      <div class="forecast-high">${Math.round(day.high)}°</div>
      <div class="forecast-low">${Math.round(day.low)}°</div>
      <div class="forecast-rain">
        <img class="rain-icon" src="icons/${rainIcon}" alt="${rainAlt}">
        ${day.rainChance}%
      </div>
    </div>
  `;
    }).join("");

    hide("forecastEmpty");

    const dayEls = strip.querySelectorAll(".forecast-day");
    dayEls.forEach((el, idx) => {
        const selectDay = () => {
            dayEls.forEach((d) => d.classList.remove("active"));
            el.classList.add("active");
            showForecastDetails(days[idx]);
        };
        el.addEventListener("click", selectDay);
        el.addEventListener("keydown", (event) => activateOnEnterOrSpace(event, selectDay));
    });
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
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// shared loading/error choreography for both search paths
async function withLoading(task, { revealWeather = true } = {}) {
    set("loading", "Fetching weather...");
    show("loading");
    if (revealWeather) {
        hide("weatherDisplay");
    }
    hide("errorMsg");

    const coldStartTimer = setTimeout(() => {
        set("loading", "Waking up the server — the first search can take up to a minute...");
    }, 4000);

    try {
        await task();
        if (revealWeather) {
            show("weatherDisplay");
        }
    } catch (err) {
        console.log("Search error:", err);
        set("errorMsg", err.message || "Could not load weather data.");
        show("errorMsg");
        if (isForecastTabActive()) {
            updateForecastEmptyState();
        }
    } finally {
        clearTimeout(coldStartTimer);
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
        renderForecast(forecastData);
        addToHistory(city);
    }, { revealWeather: false });
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
    set("timestamp", "As of " + new Date().toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    }));

    const visibilityMiles = (data.visibility / 1609.34).toFixed(1);
    set("visibility", visibilityMiles + " mi");
    set("cloudCover", data.cloudCover + "%");
    set("pressure", hpaToInHg(data.pressure) + " inHg");

    const sunriseTime = new Date(data.sunrise * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
    const sunsetTime = new Date(data.sunset * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
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

    updateGlobe(data.lat, data.lon);
}

renderHistory();
