const CirrusDesktopChannels = (function () {
    const DESKTOP_QUERY = "(min-width: 768px)";
    const state = {
        view: "grid",
        takeoverTarget: null,
        weather: null,
        forecast: [],
        globeImage: null,
        origin: null,
        clockTimer: null,
    };

    let deps = {};
    let desktopMedia = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function isDesktop() {
        return desktopMedia && desktopMedia.matches;
    }

    function titleCase(value) {
        return String(value || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    function iconPath(conditionId, weatherCode) {
        const key = weatherCode && weatherCode.endsWith("n")
            ? `${conditionId}n`
            : conditionId;
        return `icons/${iconMap[key] ?? "default.png"}`;
    }

    function setText(id, value) {
        byId(id).textContent = value;
    }

    function formatDescription(value) {
        const text = titleCase(value);
        return text ? `${text}.` : "Weather details are unavailable.";
    }

    function updateAsOf() {
        const offset = state.weather ? state.weather.timezoneOffset : 0;
        const now = deps.formatCityNow(offset);
        const text = `As of ${now.time}, ${now.date}`;
        setText("channelAsOf", text);
        setText("channelTakeoverAsOf", text);
    }

    function updateClock() {
        if (!isDesktop()) {
            return;
        }

        const now = new Date();
        const parts = now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        }).match(/^(\d+):(\d+)\s(AM|PM)$/);

        if (parts) {
            setText("channelClockHour", parts[1]);
            setText("channelClockMinute", parts[2]);
            setText("channelClockMeridiem", parts[3]);
        }
        setText("channelClockDate", now.toLocaleDateString("en-US", {
            weekday: "short",
            month: "numeric",
            day: "numeric",
        }));
        updateAsOf();
    }

    function startClock() {
        if (!isDesktop() || state.clockTimer !== null) {
            return;
        }
        updateClock();
        state.clockTimer = window.setInterval(updateClock, 1000);
    }

    function stopClock() {
        if (state.clockTimer === null) {
            return;
        }
        window.clearInterval(state.clockTimer);
        state.clockTimer = null;
    }

    function onViewportChange() {
        if (isDesktop()) {
            startClock();
        } else {
            stopClock();
        }
    }

    function currentTakeoverData() {
        if (!state.weather) {
            return null;
        }
        if (state.takeoverTarget === "today") {
            return {
                high: state.weather.tempMax,
                low: state.weather.tempMin,
                title: `Today in ${state.weather.city} — ${titleCase(state.weather.condition)}`,
                description: formatDescription(state.weather.description || state.weather.condition),
                icon: iconPath(state.weather.conditionId, state.weather.weatherCode),
                iconAlt: state.weather.description || state.weather.condition,
                wind: `${deps.degreesToCompass(state.weather.windDeg)} ${Math.round(state.weather.windSpeed)} mph`,
                extra: `Humidity ${state.weather.humidity}% · Visibility ${(state.weather.visibility / 1609.34).toFixed(1)} mi`,
                conditionId: state.weather.conditionId,
            };
        }

        const day = state.forecast[state.takeoverTarget];
        if (!day) {
            return null;
        }
        const precipInches = (day.precipitation ?? 0) / 25.4;
        return {
            high: day.high,
            low: day.low,
            title: `${String(day.day || "Forecast").toUpperCase()} — ${titleCase(day.condition)}`,
            description: formatDescription(day.description || day.condition),
            icon: iconPath(day.conditionId),
            iconAlt: day.description || day.condition,
            wind: `Wind ${Math.round(day.windSpeed ?? 0)} mph`,
            extra: `Rain ${day.rainChance ?? 0}% · Precip ${precipInches > 0 ? precipInches.toFixed(2) : "0"} in`,
            conditionId: day.conditionId,
        };
    }

    function updateTakeover() {
        const data = currentTakeoverData();
        if (!data) {
            return;
        }

        setText("channelTakeoverHigh", `${Math.round(data.high)}°`);
        setText("channelTakeoverLow", `${Math.round(data.low)}°`);
        setText("channelTakeoverTitle", data.title);
        setText("channelTakeoverDescription", data.description);
        setText("channelTakeoverWind", data.wind);
        setText("channelTakeoverExtra", data.extra);

        const icon = byId("channelTakeoverIcon");
        icon.src = data.icon;
        icon.alt = data.iconAlt;

        const screen = byId("channelTakeoverScreen");
        screen.style.setProperty(
            "--channel-globe-image",
            state.globeImage ? `url("${state.globeImage}")` : "none"
        );
        byId("channelNasaCredit").classList.toggle("hidden", !state.globeImage);
        deps.refreshAtmosphere(data.conditionId);
        updateAsOf();
    }

    function showGrid({ restoreFocus = false } = {}) {
        if (!state.weather) {
            state.view = "grid";
            state.takeoverTarget = null;
            return;
        }

        state.view = "grid";
        state.takeoverTarget = null;
        byId("channelGridWrap").classList.remove("hidden");
        byId("channelTakeover").classList.add("hidden");
        byId("channelTrayGrid").classList.add("is-active");
        byId("channelTrayToday").classList.remove("is-active");
        deps.refreshAtmosphere(state.weather.conditionId);

        if (restoreFocus && state.origin && document.contains(state.origin)) {
            state.origin.focus();
        }
    }

    function openTakeover(target, origin) {
        if (!state.weather || (target !== "today" && !state.forecast[target])) {
            return;
        }

        state.view = "takeover";
        state.takeoverTarget = target;
        state.origin = origin || document.activeElement;
        byId("channelGridWrap").classList.add("hidden");
        byId("channelTakeover").classList.remove("hidden");
        byId("channelTrayGrid").classList.remove("is-active");
        byId("channelTrayToday").classList.toggle("is-active", target === "today");
        updateTakeover();

        window.requestAnimationFrame(() => byId("channelBack").focus());
    }

    function fillGrid() {
        const weather = state.weather;
        setText("channelTodayTitle", `Today Channel · ${weather.city}`);
        setText("channelTodayTemp", `${Math.round(weather.temperature)}°`);
        const todayIcon = byId("channelTodayIcon");
        todayIcon.src = iconPath(weather.conditionId, weather.weatherCode);
        todayIcon.alt = weather.description || weather.condition;

        const dayTiles = [...document.querySelectorAll(".channel-tile--day")];
        state.forecast.forEach((day, index) => {
            const tile = dayTiles[index];
            tile.setAttribute("aria-label", `Open ${day.day} forecast channel`);
            tile.querySelector(".channel-day-label").textContent = day.day;
            const icon = tile.querySelector(".channel-day-icon");
            icon.src = iconPath(day.conditionId);
            icon.alt = day.condition || "Forecast";
            tile.querySelector(".channel-day-high").textContent = `${Math.round(day.high)}°`;
            tile.querySelector(".channel-day-low").textContent = `${Math.round(day.low)}°`;
        });
    }

    function playSearchFeedback() {
        const button = byId("desktopSearchButton");
        button.classList.remove("search-press-feedback");
        void button.offsetWidth;
        button.classList.add("search-press-feedback");
        button.addEventListener(
            "animationend",
            () => button.classList.remove("search-press-feedback"),
            { once: true }
        );
    }

    function submitSearch() {
        if (!isDesktop()) {
            return;
        }
        const city = byId("desktopCityInput").value.trim();
        if (!city) {
            return;
        }
        playSearchFeedback();
        deps.onSearch(city);
    }

    function init(dependencies) {
        deps = dependencies;
        desktopMedia = window.matchMedia(DESKTOP_QUERY);

        byId("desktopSearchButton").addEventListener("click", submitSearch);
        byId("desktopCityInput").addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                submitSearch();
            }
        });
        document.querySelectorAll("[data-channel-target]").forEach((tile) => {
            tile.addEventListener("click", () => {
                const value = tile.dataset.channelTarget;
                openTakeover(value === "today" ? "today" : Number(value), tile);
            });
        });
        byId("channelBack").addEventListener("click", () => showGrid({ restoreFocus: true }));
        byId("channelTrayGrid").addEventListener("click", () => showGrid());
        byId("channelTrayToday").addEventListener("click", (event) => openTakeover("today", event.currentTarget));
        desktopMedia.addEventListener("change", onViewportChange);
        onViewportChange();
    }

    function render(weatherData, forecastDays) {
        if (!isDesktop()) {
            return;
        }

        state.weather = weatherData;
        state.forecast = forecastDays.slice(0, 5);
        fillGrid();
        byId("channelPrompt").classList.add("hidden");
        byId("channelTrayToday").disabled = false;
        byId("channelGrid").classList.remove("channel-grid--enter");
        void byId("channelGrid").offsetWidth;
        byId("channelGrid").classList.add("channel-grid--enter");

        if (state.view === "takeover" && state.takeoverTarget !== null) {
            openTakeover(state.takeoverTarget, state.origin);
        } else {
            showGrid();
        }
        updateAsOf();
    }

    function setGlobeImage(url) {
        state.globeImage = url || null;
        if (!isDesktop()) {
            return;
        }
        if (state.view === "takeover") {
            updateTakeover();
        }
    }

    function setSearching(isSearching) {
        if (!isDesktop()) {
            return;
        }
        const button = byId("desktopSearchButton");
        button.disabled = isSearching;
        button.classList.toggle("is-searching", isSearching);
        button.setAttribute("aria-busy", String(isSearching));
    }

    return {
        init: init,
        render: render,
        setGlobeImage: setGlobeImage,
        setSearching: setSearching,
    };
})();
