//helper show or hide id
function show(id) {document.getElementById(id).classList.remove("hidden");}
function hide(id) {document.getElementById(id).classList.add("hidden");}
function set(id, value) {document.getElementById(id).textContent = value;} 


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
    } else {
        forecastView.classList.remove("hidden");
        todayView.classList.add("hidden");
        tabForecast.classList.add("active");
        tabToday.classList.remove("active");

        const city  = document.getElementById("cityInput").value.trim();
        const strip = document.getElementById("forecastStrip");
        if (city && strip.innerHTML.trim() === "") {
            fetchForecastData(city)
                .then(data => renderForecast(data))
                .catch(err => console.log("Forecast error:", err));
        }
    }

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

    if (footer) {
        footer.textContent = `As of ${timeText}, ${dateText}`;
    }

  strip.innerHTML = days.map((day, i) => {
    const isNight = day.weatherCode?.endsWith("n");
    const iconKey = isNight ? `${day.conditionId}n` : day.conditionId;
    return `
    <div class="forecast-day">
      <div class="forecast-label ${i === 0 ? 'today' : ''}">${day.day}</div>
      <img class="forecast-icon"
           src="icons/${iconMap[iconKey] ?? "default.png"}"
           alt="${day.condition}">
      <div class="forecast-high">${Math.round(day.high)}°</div>
      <div class="forecast-low">${Math.round(day.low)}°</div>
      <div class="forecast-rain">
        <img class="rain-icon" src="icons/partly-cloudy-with-rain-day.png" alt="rain">
        ${day.rainChance}%
      </div>
    </div>
  `;
  }).join(""); 

    // attach click handlers to each day to show details below
    const detailPanel = document.getElementById("forecastDetails");
    const dayEls = strip.querySelectorAll('.forecast-day');
    dayEls.forEach((el, idx) => {
        el.setAttribute('data-idx', idx);
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
            // visual active state
            dayEls.forEach(d => d.classList.remove('active'));
            el.classList.add('active');
            // show details
            showForecastDetails(days[idx]);
        });
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
        <div class="details-card">
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
    // scroll into view so user sees the details below the strip
    panel.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// shared loading/error choreography for both search paths
async function withLoading(task) {
    set("loading", "Fetching weather...");
    show("loading");
    hide("weatherDisplay");
    hide("errorMsg");

    // if the request drags on it has to be Render cold start
    const coldStartTimer = setTimeout(() => {
        set("loading", "Waking up the server — the first search can take up to a minute...");
    }, 4000);

    try {
        await task();
        show("weatherDisplay");
    } catch (err) {
        console.log("Search error:", err);
        set("errorMsg", err.message || "Could not load weather data.");
        show("errorMsg");
    } finally {
        clearTimeout(coldStartTimer);
        hide("loading");
    }
}

function getWeatherForecast() {
    const city = document.getElementById("cityInputForecast").value.trim();
    if (!city) return;

    // sync to main input
    document.getElementById("cityInput").value = city;
    document.getElementById("forecastStrip").innerHTML = "";

    withLoading(async () => {
        const [weatherData, forecastData] = await Promise.all([
            fetchWeatherData(city),
            fetchForecastData(city),
        ]);
        renderTodayView(weatherData);
        renderForecast(forecastData);
    });
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

    // preload before swapping so there's no flash
    const img = new Image();
    img.onload = () => {
        globe.style.backgroundImage = `url('${nasaUrl}')`;
        globe.classList.remove("globe-hidden");
    };
    img.onerror = () => {
        // NASA tile failed — silently hide globe rather than break the UI
        globe.classList.add("globe-hidden");
    };
    img.src = nasaUrl;
}

function renderTodayView(data) {
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
    set("pressure", data.pressure + " hPa");

    const sunriseTime = new Date(data.sunrise * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
    const sunsetTime = new Date(data.sunset * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
    set("sunrise", sunriseTime);
    set("sunset", sunsetTime);

    const isNight = data.weatherCode.endsWith("n");
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

function getWeather() {
    const city = document.getElementById("cityInput").value.trim();
    if (!city) return;

    withLoading(async () => {
        renderTodayView(await fetchWeatherData(city));
    });
}