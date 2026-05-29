const iconMap = {

  // ══ DAY VARIANTS ══════════════════════════════════════════

  // ── THUNDERSTORM ──────────────────────────────────────────
  200: "partly-cloudy-with-thunderstorms-day.png",
  201: "partly-cloudy-with-thunderstorms-day.png",
  202: "mostly-cloudy-with-thunderstorms-day.png",
  210: "partly-cloudy-with-thunder-day.png",
  211: "mostly-cloudy-with-thunder-day.png",
  212: "mostly-cloudy-with-thunderstorms-day.png",
  221: "mostly-cloudy-with-thunderstorms-day.png",
  230: "partly-cloudy-with-thunderstorms-day.png",
  231: "mostly-cloudy-with-thunderstorms-day.png",
  232: "mostly-cloudy-with-thunderstorms-day.png",

  // ── DRIZZLE ───────────────────────────────────────────────
  300: "partly-cloudy-with-rain-day.png",
  301: "partly-cloudy-with-rain-day.png",
  302: "mostly-cloudy-with-rain-day.png",
  310: "partly-cloudy-with-rain-day.png",
  311: "mostly-cloudy-with-rain-day.png",
  312: "mostly-cloudy-with-rain-day.png",
  313: "mostly-cloudy-with-rain-day.png",
  314: "mostly-cloudy-with-rain-day.png",
  321: "mostly-cloudy-with-rain-day.png",

  // ── RAIN ──────────────────────────────────────────────────
  500: "partly-cloudy-with-rain-day.png",
  501: "mostly-cloudy-with-rain-day.png",
  502: "mostly-cloudy-with-rain-day.png",
  503: "mostly-cloudy-with-rain-day.png",
  504: "mostly-cloudy-with-rain-day.png",
  511: "mostly-cloudy-with-mixed-day.png",
  520: "partly-cloudy-with-rain-day.png",
  521: "mostly-cloudy-with-rain-day.png",
  522: "mostly-cloudy-with-rain-day.png",
  531: "mostly-cloudy-with-rain-day.png",

  // ── SNOW ──────────────────────────────────────────────────
  600: "partly-cloudy-with-snow-day.png",
  601: "mostly-cloudy-with-snow-day.png",
  602: "mostly-cloudy-with-snow-day.png",
  611: "mostly-cloudy-with-sleet-day.png",
  612: "partly-cloudy-with-sleet-day.png",
  613: "mostly-cloudy-with-sleet-day.png",
  615: "mostly-cloudy-with-mixed-day.png",
  616: "mostly-cloudy-with-mixed-day.png",
  620: "mostly-cloudy-with-mixed-day.png",
  621: "mostly-cloudy-with-snow-and-sleet-day.png",
  622: "mostly-cloudy-with-snow-and-sleet-day.png",

  // ── ATMOSPHERE ────────────────────────────────────────────
  701: "mist.png",
  711: "haze.png",
  721: "haze.png",
  731: "haze.png",
  741: "fog.png",
  751: "haze.png",
  761: "haze.png",
  762: "haze.png",
  771: "mostly-cloudy-with-rain-day.png",
  781: "mostly-cloudy-with-thunderstorms-day.png",

  // ── CLEAR ─────────────────────────────────────────────────
  800: "clear-day.png",

  // ── CLOUDS ────────────────────────────────────────────────
  801: "partly-cloudy-day.png",
  802: "partly-cloudy-day.png",
  803: "mostly-cloudy-day.png",
  804: "mostly-cloudy-day.png",

  // NIGHT VARIANTS 

  // ── THUNDERSTORM NIGHT ────────────────────────────────────
  "200n": "partly-cloudy-with-thunderstorms-night.png",
  "201n": "partly-cloudy-with-thunderstorms-night.png",
  "202n": "mostly-cloudy-with-thunderstorms-night.png",
  "210n": "partly-cloudy-with-thunder-night.png",
  "211n": "mostly-cloudy-with-thunder-night.png",
  "212n": "mostly-cloudy-with-thunderstorms-night.png",
  "221n": "mostly-cloudy-with-thunderstorms-night.png",
  "230n": "partly-cloudy-with-thunderstorms-night.png",
  "231n": "mostly-cloudy-with-thunderstorms-night.png",
  "232n": "mostly-cloudy-with-thunderstorms-night.png",

  // ── DRIZZLE NIGHT ─────────────────────────────────────────
  "300n": "partly-cloudy-with-rain-night.png",
  "301n": "partly-cloudy-with-rain-night.png",
  "302n": "mostly-cloudy-with-rain-night.png",
  "310n": "partly-cloudy-with-rain-night.png",
  "311n": "mostly-cloudy-with-rain-night.png",
  "312n": "mostly-cloudy-with-rain-night.png",
  "313n": "mostly-cloudy-with-rain-night.png",
  "314n": "mostly-cloudy-with-rain-night.png",
  "321n": "mostly-cloudy-with-rain-night.png",

  // ── RAIN NIGHT ────────────────────────────────────────────
  "500n": "partly-cloudy-with-rain-night.png",
  "501n": "mostly-cloudy-with-rain-night.png",
  "502n": "mostly-cloudy-with-rain-night.png",
  "503n": "mostly-cloudy-with-rain-night.png",
  "504n": "mostly-cloudy-with-rain-night.png",
  "511n": "mostly-cloudy-with-mixed-night.png",
  "520n": "partly-cloudy-with-rain-night.png",
  "521n": "mostly-cloudy-with-rain-night.png",
  "522n": "mostly-cloudy-with-rain-night.png",
  "531n": "mostly-cloudy-with-rain-night.png",

  // ── SNOW NIGHT ────────────────────────────────────────────
  "600n": "partly-cloudy-with-snow-night.png",
  "601n": "mostly-cloudy-with-snow-night.png",
  "602n": "mostly-cloudy-with-snow-night.png",
  "611n": "mostly-cloudy-with-sleet-night.png",
  "612n": "partly-cloudy-with-sleet-night.png",
  "613n": "mostly-cloudy-with-sleet-night.png",
  "615n": "mostly-cloudy-with-mixed-night.png",
  "616n": "mostly-cloudy-with-mixed-night.png",
  "620n": "mostly-cloudy-with-mixed-night.png",
  "621n": "mostly-cloudy-with-snow-and-sleet-night.png",
  "622n": "mostly-cloudy-with-snow-and-sleet-night.png",

  // ── ATMOSPHERE NIGHT ──────────────────────────────────────
  "701n": "mist.png",
  "711n": "haze.png",
  "721n": "haze.png",
  "731n": "haze.png",
  "741n": "fog.png",
  "751n": "haze.png",
  "761n": "haze.png",
  "762n": "haze.png",
  "771n": "mostly-cloudy-with-rain-night.png",
  "781n": "mostly-cloudy-with-thunderstorms-night.png",

  // ── CLEAR NIGHT ───────────────────────────────────────────
  "800n": "clear-night.png",

  // ── CLOUDS NIGHT ──────────────────────────────────────────
  "801n": "partly-cloudy-night.png",
  "802n": "partly-cloudy-night.png",
  "803n": "mostly-cloudy-night.png",
  "804n": "mostly-cloudy-night.png",
};

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

function isLocalDevelopment() {
    if (typeof window === "undefined" || !window.location) {
        return false;
    }

    return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function getWeatherApiKey() {
    if (typeof window === "undefined") {
        return "";
    }

    return (window.WEATHER_API_KEY || "").trim();
}

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
        lon:data.lon, 
    };
}

function normalizeOpenWeatherData(data) {
    const weather = data.weather?.[0] || {};

    return {
        city: data.name,
        temperature: data.main?.temp,
        feelsLike: data.main?.feels_like,
        humidity: data.main?.humidity,
        condition: weather.description || "Unknown",
        windSpeed: data.wind?.speed || 0,
        weatherCode: weather.icon || "",
        conditionId: weather.id || 800,
        windDeg: data.wind?.deg || 0,
        description: weather.description || "Weather conditions",
    };
}

async function fetchWeatherData(city) {
    const key = normalizeCityKey(city);
    const cached = getCachedEntry(clientCache.weather, key);
    if (cached) {
        return cached;
    }

    const BACKEND_URL =
        "https://weatherapp-project-6rms.onrender.com";

    const response = await fetch(
        `${BACKEND_URL}/weather?city=${encodeURIComponent(city)}`

    );

    if (!response.ok) {
        let errorMessage = "Something went wrong.";

        try {

            const err = await response.json();
            errorMessage = err.error || errorMessage;

        } catch (parseError) {
            console.log("Could not parse backend error response:", parseError);

        }
        //  message if rate limit
        if (response.status === 429) {
            errorMessage = "Too many searches — please wait a minute.";
        }
        throw new Error(errorMessage);
    }
    const data = normalizeBackendWeatherData(await response.json());
    setCachedEntry(clientCache.weather, key, data);
    return data;

}

async function fetchForecastData(city) {
    const key = normalizeCityKey(city);
    const cached = getCachedEntry(clientCache.forecast, key);
    if (cached) {
        return cached;
    }

    const response = await fetch(`https://weatherapp-project-6rms.onrender.com/forecast?city=${encodeURIComponent(city)}`);

    if (!response.ok) {
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

        throw new Error(errorMessage);
    }

    const data = await response.json();
    setCachedEntry(clientCache.forecast, key, data);
    return data;

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
        // restore globe if a city is loaded
        if (globe.style.backgroundImage) {
            globe.classList.remove("globe-hidden");
        }
    } else {
        forecastView.classList.remove("hidden");
        todayView.classList.add("hidden");
        tabForecast.classList.add("active");
        tabToday.classList.remove("active");

        const city  = document.getElementById("cityInput").value.trim();
        const strip = document.getElementById("forecastStrip");
        if (city && strip.innerHTML.trim() === "") {
            fetch(`https://weatherapp-project-6rms.onrender.com/forecast?city=${encodeURIComponent(city)}`)
                .then(res => res.json())
                .then(data => renderForecast(data))
                .catch(err => console.log("Forecast error:", err));
        }
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

  strip.innerHTML = days.map((day, i) => `
    <div class="forecast-day">
      <div class="forecast-label ${i === 0 ? 'today' : ''}">${day.day}</div>
      <img class="forecast-icon"
           src="icons/${iconMap[day.conditionId] ?? "default.png"}"
           alt="${day.condition}">
      <div class="forecast-high">${Math.round(day.high)}°</div>
      <div class="forecast-low">${Math.round(day.low)}°</div>
      <div class="forecast-rain">
        <img class="rain-icon" src="icons/partly-cloudy-with-rain-day.png" alt="rain">
        ${day.rainChance}%
      </div>
    </div>
  `).join(""); 

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
    const precip = day.precipitation || day.precip || '—';
    const wind = day.windSpeed ? `${Math.round(day.windSpeed)} mph` : '—';

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

function getWeatherForecast() {
    const city = document.getElementById("cityInputForecast").value.trim();
    if (!city) return;

    // sync to main input
    document.getElementById("cityInput").value = city;
    show("loading");
    hide("weatherDisplay");
    hide("errorMsg");

    const strip = document.getElementById("forecastStrip");
    strip.innerHTML = "";

    Promise.all([fetchWeatherData(city), fetchForecastData(city)])
        .then(([weatherData, forecastData]) => {
            set("cityName", weatherData.city);
            set("tempMain", Math.round(weatherData.temperature) + "°F");

            const conditionFormatted = weatherData.condition
                .split(" ")
                .map(w => w[0].toUpperCase() + w.slice(1))
                .join(" ");
            const conditionEl = document.getElementById('conditionText');
            const feelsEl = document.getElementById('feelsExplanation');
            if (conditionEl) conditionEl.textContent = conditionFormatted;
            if (feelsEl) {
                const expl = getFeelsLikeExplanation(weatherData.temperature, weatherData.feelsLike, weatherData.windSpeed, weatherData.humidity);
                feelsEl.textContent = ` — ${expl}`;
            }

            set("feelsLike", Math.round(weatherData.feelsLike) + "°F");
            set("humidity", weatherData.humidity + "%");
            set("wind", Math.round(weatherData.windSpeed) + " mph");
            set("windDir", degreesToCompass(weatherData.windDeg) + " " + Math.round(weatherData.windSpeed) + " mph");
            set("timestamp", "As of " + new Date().toLocaleTimeString([], {
                hour: "2-digit", minute: "2-digit"
            }));

            const visibilityMiles = (weatherData.visibility / 1609.34).toFixed(1);
            set("visibility", visibilityMiles + " mi");
            set("cloudCover", weatherData.cloudCover + "%");
            set("pressure", weatherData.pressure + " hPa");

            const sunriseTime = new Date(weatherData.sunrise * 1000).toLocaleTimeString([], {
                hour: "2-digit", minute: "2-digit"
            });
            const sunsetTime = new Date(weatherData.sunset * 1000).toLocaleTimeString([], {
                hour: "2-digit", minute: "2-digit"
            });
            set("sunrise", sunriseTime);
            set("sunset", sunsetTime);

            const conditionId = weatherData.conditionId;
            const isNight = weatherData.weatherCode.endsWith("n");
            const key = isNight ? `${conditionId}n` : conditionId;
            const iconSrc = "icons/" + (iconMap[key] ?? "default.png");

            const iconEl = document.getElementById("weatherIcon");
            iconEl.innerHTML = "";
            const img = document.createElement("img");
            img.src = iconSrc;
            img.alt = weatherData.description;
            img.className = "weather-img";
            iconEl.appendChild(img);

            show("weatherDisplay");
            renderForecast(forecastData);
            hide("loading");
        })
        .catch(err => {
            console.log("Search error:", err);
            set("errorMsg", err.message || "Could not load weather data.");
            show("errorMsg");
            hide("loading");
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
//main
function updateGlobe(lat, lon) {
    // NASA GIBS WMS endpoint — no API key required
    // VIIRS_SNPP_CorrectedReflectance_TrueColor is the full-color satellite layer
    const width  = 1024;
    const height = 512;

    // calculate bounding box — how much of the globe to show
    // larger spread = more zoomed out, more globe visible
    const spread = 30;
    const spreadLat = spread * 0.6 //tigher vertically

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

async function getWeather() {

    //read city imput bail out if empty

    const city = document.getElementById("cityInput").value.trim();
    if (!city) return;

    //show loading
    
    show("loading");
    hide("weatherDisplay");
    hide("errorMsg");

    try {
        const data = await fetchWeatherData(city);

    set("cityName", data.city);
    set("tempMain", Math.round(data.temperature) + "°F");
    // set condition text add feelslike explanation
    const conditionFormatted = data.condition
                    .split(" ")
                    .map(w => w[0].toUpperCase() + w.slice(1))
                    .join(" ");
    const conditionEl = document.getElementById('conditionText');
    const feelsEl = document.getElementById('feelsExplanation');
    if (conditionEl) conditionEl.textContent = conditionFormatted;
    if (feelsEl) {
        const expl = getFeelsLikeExplanation(data.temperature, data.feelsLike, data.windSpeed, data.humidity);
        feelsEl.textContent = ` — ${expl}`;
    }
    
    set("feelsLike", Math.round(data.feelsLike) + "°F");
    set("humidity", data.humidity + "%");
    set("wind", Math.round(data.windSpeed) + " mph");
    set("windDir",   degreesToCompass(data.windDeg) + " " + Math.round(data.windSpeed) + " mph");
    set("timestamp", "As of " + new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit"
    }));

    // new fields
    const visibilityMiles = (data.visibility / 1609.34).toFixed(1);
    set("visibility", visibilityMiles + " mi");
    set("cloudCover", data.cloudCover + "%");
    set("pressure",   data.pressure + " hPa");

    const sunriseTime = new Date(data.sunrise * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
    const sunsetTime = new Date(data.sunset * 1000).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit"
    });
    set("sunrise", sunriseTime);
    set("sunset",  sunsetTime);


    // resolve the icon using code and day/night

    const conditionId = data.conditionId;
    const isNight = data.weatherCode.endsWith("n");
   const key = isNight ? `${conditionId}n` : conditionId;
    const iconSrc = "icons/" + (iconMap[key] ?? "default.png");

    const iconEl = document.getElementById("weatherIcon");
    iconEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = data.description;
    img.className = "weather-img";
    iconEl.appendChild(img);

   updateGlobe(data.lat, data.lon); 

    // show the card, hide loading
    show("weatherDisplay");
    hide("loading");
     



    } catch (err) {
        //handle network failures
        console.log("Caught error:", err);
        set("errorMsg", err.message || "Could not load weather data.")
        show("errorMsg");
        hide("loading");
    }
}