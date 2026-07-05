const CirrusForecast = (function () {
    const FORECAST_HINT_KEY = "cirrus_forecast_hint_dismissed";
    const CARD_POP_DELAY_MS = 520;
    const CARD_STAGGER_MS = 150;
    const CARD_SLIDE_PX = 44;
    const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

    let activeTab = "today";
    let tabSwitchPending = false;
    let lastSwipeStart = -Infinity;

    let showEl = () => {};
    let hideEl = () => {};
    let playAnimation = () => {};
    let prefersReducedMotion = () => false;
    let bounceTab = () => {};
    let withLoading = async () => {};
    let fetchWeatherData = async () => {};
    let fetchForecastData = async () => {};
    let getCachedEntry = () => null;
    let normalizeCityKey = () => "";
    let completeForecastLoad = () => {};
    let getCurrentConditionId = () => null;
    let refreshAtmosphere = () => {};
    let updateTodayEmptyState = () => {};
    let activateOnEnterOrSpace = () => {};
    let formatCityNow = () => ({ time: "", date: "" });
    let getTimezoneOffset = () => 0;
    let onTodayTabActive = () => {};

    function init(deps) {
        showEl = deps.show;
        hideEl = deps.hide;
        playAnimation = deps.playAnimation;
        prefersReducedMotion = deps.prefersReducedMotion;
        bounceTab = deps.bounceTab;
        withLoading = deps.withLoading;
        fetchWeatherData = deps.fetchWeatherData;
        fetchForecastData = deps.fetchForecastData;
        getCachedEntry = deps.getCachedEntry;
        normalizeCityKey = deps.normalizeCityKey;
        completeForecastLoad = deps.completeForecastLoad;
        getCurrentConditionId = deps.getCurrentConditionId;
        refreshAtmosphere = deps.refreshAtmosphere;
        updateTodayEmptyState = deps.updateTodayEmptyState;
        activateOnEnterOrSpace = deps.activateOnEnterOrSpace;
        formatCityNow = deps.formatCityNow;
        getTimezoneOffset = deps.getTimezoneOffset;
        onTodayTabActive = deps.onTodayTabActive ?? (() => {});
    }

    function isForecastTabActive() {
        return activeTab === "forecast";
    }

    function forecastDayCards() {
        return [...document.querySelectorAll("#forecastStrip .forecast-day")];
    }

    function cancelCardAnimations(card) {
        card.getAnimations().forEach((anim) => anim.cancel());
    }

    function hideForecastCards() {
        if (prefersReducedMotion()) {
            return;
        }
        forecastDayCards().forEach((card) => {
            cancelCardAnimations(card);
            card.style.opacity = "0";
        });
    }

    function cardPopBaseDelay() {
        return Math.max(0, CARD_POP_DELAY_MS - (performance.now() - lastSwipeStart));
    }

    function popInForecastCards() {
        const reduced = prefersReducedMotion();
        forecastDayCards().forEach((card, i) => {
            cancelCardAnimations(card);
            card.style.opacity = "";
            if (reduced) {
                return;
            }
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

    function dismissForecastHint() {
        hideEl("forecastHint");
        localStorage.setItem(FORECAST_HINT_KEY, "1");
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
            hideEl("forecastEmpty");
            return;
        }

        if (!city) {
            empty.textContent = "Search a city to see the 5-day forecast.";
            showEl("forecastEmpty");
            return;
        }

        hideEl("forecastEmpty");
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

    function applyTab(tab) {
        activeTab = tab;
        const isToday = tab === "today";
        const todayView = document.getElementById("todayView");
        const forecastView = document.getElementById("forecastView");
        const tabToday = document.getElementById("tabToday");
        const tabForecast = document.getElementById("tabForecast");
        const globe = document.getElementById("globeBg");

        lastSwipeStart = performance.now();
        document.getElementById("viewTrack").classList.toggle("view-track--forecast", !isToday);

        tabToday.classList.toggle("active", isToday);
        tabForecast.classList.toggle("active", !isToday);
        tabToday.setAttribute("aria-selected", String(isToday));
        tabForecast.setAttribute("aria-selected", String(!isToday));
        tabToday.tabIndex = isToday ? 0 : -1;
        tabForecast.tabIndex = isToday ? -1 : 0;

        todayView.inert = !isToday;
        todayView.setAttribute("aria-hidden", String(!isToday));
        forecastView.inert = isToday;
        forecastView.setAttribute("aria-hidden", String(isToday));

        if (isToday) {
            updateTodayEmptyState();
            const conditionId = getCurrentConditionId();
            if (conditionId !== null) {
                refreshAtmosphere(conditionId);
            }
            onTodayTabActive();
        } else {
            updateForecastEmptyState();
        }

        if (globe.style.backgroundImage) {
            globe.classList.remove("globe-hidden");
        }
    }

    function switchTab(tab) {
        if (tab === activeTab || tabSwitchPending) {
            return;
        }

        bounceTab(document.getElementById(tab === "today" ? "tabToday" : "tabForecast"));

        if (tab === "forecast") {
            hideForecastCards();
            applyTab("forecast");
            popInForecastCards();
            loadIfNeeded();
            return;
        }

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

    function loadIfNeeded() {
        const city = document.getElementById("cityInput").value.trim();
        const strip = document.getElementById("forecastStrip");
        if (!city || strip.innerHTML.trim() !== "") {
            return;
        }

        hideEl("forecastEmpty");

        withLoading(async () => {
            const cityKey = normalizeCityKey(city);
            const cachedWeather = getCachedEntry(cityKey);
            const weatherPromise = cachedWeather
                ? Promise.resolve(cachedWeather)
                : fetchWeatherData(city);

            const [forecastData, weatherData] = await Promise.all([
                fetchForecastData(city),
                weatherPromise,
            ]);
            completeForecastLoad(city, weatherData, forecastData);
        }, { revealWeather: false, loadingMessage: "Fetching forecast…", preserveAlertSession: true });
    }

    function render(days, timezoneOffset) {
        const offset = timezoneOffset ?? getTimezoneOffset();
        const strip = document.getElementById("forecastStrip");
        const footer = document.getElementById("forecastFooter");
        const { time: timeText, date: dateText } = formatCityNow(offset);

        footer.textContent = `As of ${timeText}, ${dateText}`;

        strip.innerHTML = days.map((day, i) => {
            const iconKey = day.conditionId;
            const rainIcon = forecastRainIcon(day);
            const rainAlt = (day.rainChance ?? 0) > 0
                ? `${day.rainChance}% chance of rain`
                : "No rain expected";
            return `
    <div class="forecast-day glass-panel" role="button" tabindex="0" aria-label="${day.day} forecast">
      <div class="forecast-label ${i === 0 ? "today" : ""}">${day.day}</div>
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

        hideEl("forecastEmpty");

        if (!localStorage.getItem(FORECAST_HINT_KEY)) {
            showEl("forecastHint");
        }

        const dayEls = strip.querySelectorAll(".forecast-day");
        dayEls.forEach((el, idx) => {
            const selectDay = () => {
                dismissForecastHint();
                dayEls.forEach((d) => d.classList.remove("active"));
                el.classList.add("active");
                showDetails(days[idx]);
            };
            el.addEventListener("click", selectDay);
            el.addEventListener("keydown", (event) => activateOnEnterOrSpace(event, selectDay));
        });

        popInForecastCards();
    }

    function showDetails(day) {
        const panel = document.getElementById("forecastDetails");
        if (!panel) {
            return;
        }

        const description = day.description || day.condition || "";
        const rain = (day.rainChance !== undefined) ? `${day.rainChance}%` : "—";
        const precipInches = (day.precipitation ?? 0) / 25.4;
        const precip = precipInches > 0 ? `${precipInches.toFixed(2)} in` : "0 in";
        const wind = (day.windSpeed !== undefined) ? `${Math.round(day.windSpeed)} mph` : "—";

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
        panel.classList.remove("hidden");
        const card = panel.querySelector(".details-card");
        playAnimation(card, "anim-pop");
        if (day.conditionId !== undefined) {
            refreshAtmosphere(day.conditionId);
        }
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function prepareSearch() {
        document.getElementById("forecastStrip").innerHTML = "";
        hideForecastDetails();
        hideEl("forecastEmpty");
    }

    return {
        init,
        isForecastTabActive,
        switchTab,
        onTabKeydown,
        render,
        prepareSearch,
        hideForecastDetails,
        updateForecastEmptyState,
    };
})();

function switchTab(tab) {
    CirrusForecast.switchTab(tab);
}

function onTabKeydown(event, tab) {
    CirrusForecast.onTabKeydown(event, tab);
}
