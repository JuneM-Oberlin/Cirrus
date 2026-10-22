/* Desktop Home: the channel menu. Tiles show a live preview of today and
   the next five days; choosing one opens the forecast frame at the
   matching view. Phones never show this screen. */

const CirrusDesktopChannels = (function () {
    const DESKTOP_QUERY = "(min-width: 768px)";
    const state = {
        weather: null,
        forecast: [],
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

    function iconPath(conditionId, weatherCode) {
        let key = conditionId;
        if (weatherCode && weatherCode.endsWith("n")) {
            key = `${conditionId}n`;
        }
        return `icons/${iconMap[key] ?? "default.png"}`;
    }

    function setText(id, value) {
        byId(id).textContent = value;
    }

    // Until a city loads there is nothing to be "as of", so keep the dashes.
    function updateAsOf() {
        if (!state.weather) {
            setText("channelAsOf", "As of --:--");
            return;
        }
        setText("channelAsOf", deps.formatAsOf(state.weather));
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

    function fillGrid() {
        const weather = state.weather;
        setText("channelTodayTitle", `Today Channel · ${weather.city}`);
        setText("channelTodayTemp", deps.formatTemp(weather.temperature));
        const todayIcon = byId("channelTodayIcon");
        todayIcon.src = iconPath(weather.conditionId, weather.weatherCode);
        todayIcon.alt = weather.description || weather.condition;

        const dayTiles = [...document.querySelectorAll(".channel-tile--day")];
        state.forecast.forEach((day, index) => {
            const tile = dayTiles[index];
            tile.setAttribute("aria-label", `Open ${day.day} forecast`);
            tile.querySelector(".channel-day-label").textContent = day.day;
            const icon = tile.querySelector(".channel-day-icon");
            icon.src = iconPath(day.conditionId);
            icon.alt = day.condition || "Forecast";
            tile.querySelector(".channel-day-high").textContent = deps.formatTemp(day.high);
            tile.querySelector(".channel-day-low").textContent = deps.formatTemp(day.low);
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

    // tile is the Home tile the channel zooms out of
    function openChannel(target, tile) {
        if (!state.weather) {
            return;
        }
        deps.onOpenChannel(target, tile);
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
                if (value === "today") {
                    openChannel("today", tile);
                } else {
                    openChannel(Number(value), tile);
                }
            });
        });
        byId("channelTrayToday").addEventListener("click", () => {
            openChannel("today", document.querySelector(".channel-tile--today"));
        });
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
        byId("channelGridWrap").classList.remove("hidden");
        byId("channelTrayToday").disabled = false;
        byId("channelGrid").classList.remove("channel-grid--enter");
        void byId("channelGrid").offsetWidth;
        byId("channelGrid").classList.add("channel-grid--enter");
        updateAsOf();
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
        setSearching: setSearching,
    };
})();
