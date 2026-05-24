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
        throw new Error(errorMessage);
    }
    return normalizeBackendWeatherData(await response.json());

}

//main

async function getWeather() {

    //read city imput - bail out if empty

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
    set("condition", data.condition
                    .split(" ")
                    .map(w => w[0].toUpperCase() + w.slice(1))
                    .join(" "));
    
    set("feelsLike", Math.round(data.feelsLike) + "°F");
    set("humidity", data.humidity + "%");
    set("wind", Math.round(data.windSpeed) + " mph");
    set("windDir",   degreesToCompass(data.windDeg) + " " + Math.round(data.windSpeed) + " mph");
    set("timestamp", "As of " + new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit"
    }));


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