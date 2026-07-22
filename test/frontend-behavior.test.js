const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const quietConsole = { log() {}, warn() {}, error() {} };

function classList(...initial) {
    const values = new Set(initial);
    return {
        add: (...names) => names.forEach((name) => values.add(name)),
        remove: (...names) => names.forEach((name) => values.delete(name)),
        contains: (name) => values.has(name),
        toggle(name, force) {
            const enabled = force === undefined ? !values.has(name) : Boolean(force);
            if (enabled) {
                values.add(name);
            } else {
                values.delete(name);
            }
            return enabled;
        },
    };
}

function element(ownerDocument, id = "") {
    const listeners = new Map();
    const attributes = new Map();
    const styleValues = new Map();
    const node = {
        id,
        alt: "",
        children: [],
        classList: classList(),
        className: "",
        currentTime: 0,
        dataset: {},
        disabled: false,
        hidden: false,
        inert: false,
        innerHTML: "",
        offsetParent: {},
        offsetWidth: 100,
        scrollIntoView() {},
        src: "",
        tabIndex: 0,
        textContent: "",
        value: "",
        style: {
            backgroundImage: "",
            display: "",
            opacity: "",
            setProperty: (name, value) => styleValues.set(name, value),
            removeProperty: (name) => styleValues.delete(name),
            getPropertyValue: (name) => styleValues.get(name) || "",
        },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        dispatch(type, event = {}) {
            const payload = { currentTarget: node, target: node, ...event };
            (listeners.get(type) || []).slice().forEach((handler) => handler(payload));
        },
        appendChild(child) {
            child.parentNode = node;
            node.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            node.children = children;
            children.forEach((child) => { child.parentNode = node; });
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) ?? null;
        },
        focus() {
            ownerDocument.activeElement = node;
        },
        getAnimations: () => [],
        animate: () => ({ cancel() {} }),
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        pause() {},
        play: () => Promise.resolve(),
        remove() {
            if (node.parentNode) {
                node.parentNode.children = node.parentNode.children.filter((child) => child !== node);
            }
        },
    };
    return node;
}

function documentStub() {
    const nodes = new Map();
    const listeners = new Map();
    const document = {
        activeElement: null,
        visibilityState: "visible",
        body: null,
        getElementById(id) {
            if (!nodes.has(id)) {
                nodes.set(id, element(document, id));
            }
            return nodes.get(id);
        },
        createElement: (tagName) => element(document, tagName),
        querySelectorAll: () => [],
        contains: () => true,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
        },
        dispatch(type, event = {}) {
            (listeners.get(type) || []).slice().forEach((handler) => handler(event));
        },
    };
    document.body = element(document, "body");
    return document;
}

function storageStub(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
    };
}

function runClassicScript(relativePath, globals = {}) {
    const context = vm.createContext({
        console,
        clearInterval,
        clearTimeout,
        setInterval,
        setTimeout,
        ...globals,
    });
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
    return context;
}

function lexical(context, expression) {
    return vm.runInContext(expression, context);
}

test("atmosphere preserves every weather-code boundary and controls effect lifecycles", () => {
    const document = documentStub();
    const layer = document.getElementById("weatherAtmosphere");
    const rainCalls = [];
    const lightningCalls = [];
    let alertRank = "none";
    const context = runClassicScript("public/atmosphere.js", {
        document,
        requestAnimationFrame: (callback) => callback(),
        conditionHasThunder: (id) => Number(id) >= 200 && Number(id) <= 232,
        thunderIconIntensity: () => "normal",
        CirrusAlerts: { getStormLightningRank: () => alertRank },
        AtmoRainVideo: {
            start: (profile) => rainCalls.push(["start", profile]),
            stop: () => rainCalls.push(["stop"]),
        },
        AtmoLightning: {
            start: (profile) => lightningCalls.push(["start", profile]),
            stop: () => lightningCalls.push(["stop"]),
        },
    });
    const atmosphere = lexical(context, "CirrusAtmosphere");

    const cases = new Map([
        ["invalid", "clear"], [199, "clear"], [200, "thunderstorm"], [232, "thunderstorm"], [233, "clear"],
        [299, "clear"], [300, "drizzle"], [321, "drizzle"], [322, "clear"],
        [499, "clear"], [500, "rain"], [501, "rain"], [502, "rain-heavy"], [504, "rain-heavy"], [505, "clear"],
        [510, "sleet"], [511, "sleet"], [519, "clear"], [520, "rain"], [531, "rain"], [532, "clear"],
        [599, "clear"], [600, "snow"], [602, "snow"], [603, "clear"], [611, "sleet"], [612, "sleet"],
        [613, "sleet"], [614, "clear"], [615, "sleet"], [616, "sleet"], [619, "clear"], [620, "snow"],
        [622, "snow"], [623, "clear"], [700, "clear"], [701, "fog"], [762, "fog"], [763, "clear"],
        [770, "clear"], [771, "thunderstorm"], [772, "clear"], [781, "thunderstorm"], [800, "clear"],
        [801, "clouds"], [802, "clouds"], [803, "clouds-heavy"], [999, "clouds-heavy"],
    ]);
    cases.forEach((expected, id) => {
        atmosphere.refresh(id);
        assert.equal(layer.dataset.effect, expected, `condition ${id}`);
    });

    atmosphere.refresh(200);
    assert.deepEqual(rainCalls.at(-1), ["start", "rain-heavy"]);
    assert.deepEqual(lightningCalls.at(-1), ["start", "normal"]);

    alertRank = "severe";
    atmosphere.refresh(800);
    assert.deepEqual(lightningCalls.at(-1), ["start", "severe"]);

    alertRank = "none";
    atmosphere.refresh(800);
    assert.deepEqual(rainCalls.at(-1), ["stop"]);
    assert.deepEqual(lightningCalls.at(-1), ["stop"]);
    assert.equal(layer.classList.contains("is-hidden"), true);
});

test("forecast escapes strings and supports tabs plus desktop and mobile details", () => {
    const document = documentStub();
    const strip = document.getElementById("forecastStrip");
    const panel = document.getElementById("forecastDetails");
    const detailCard = element(document, "detailsCard");
    panel.querySelector = (selector) => selector === ".details-card" ? detailCard : null;

    const dayCard = element(document, "dayCard");
    const inlineDetail = element(document, "inlineDetail");
    inlineDetail.hidden = true;
    const dayWrap = element(document, "dayWrap");
    dayWrap.querySelector = (selector) => selector === ".forecast-day-detail" ? inlineDetail : null;
    dayCard.closest = (selector) => selector === ".forecast-day-wrap" ? dayWrap : null;
    strip.querySelectorAll = (selector) => {
        if (selector === ".forecast-day") {
            return [dayCard];
        }
        if (selector === ".forecast-day-detail") {
            return [inlineDetail];
        }
        return [];
    };

    let mobile = false;
    const refreshed = [];
    const context = runClassicScript("public/forecast.js", {
        document,
        window: { matchMedia: () => ({ matches: mobile }) },
        localStorage: storageStub(),
        performance: { now: () => 1000 },
        iconMap: { 500: "rain.png" },
    });
    const forecast = lexical(context, "CirrusForecast");
    forecast.init({
        show: (id) => document.getElementById(id).classList.remove("hidden"),
        hide: (id) => document.getElementById(id).classList.add("hidden"),
        playAnimation: () => {},
        prefersReducedMotion: () => true,
        bounceTab: () => {},
        withLoading: async (task) => task(),
        fetchWeatherData: async () => ({}),
        fetchForecastData: async () => [],
        getCachedEntry: () => null,
        normalizeCityKey: (city) => city.toLowerCase(),
        completeForecastLoad: () => {},
        getCurrentConditionId: () => 800,
        refreshAtmosphere: (id) => refreshed.push(id),
        updateTodayEmptyState: () => {},
        activateOnEnterOrSpace: (event, action) => {
            if (event.key === "Enter" || event.key === " ") {
                action();
            }
        },
        formatCityNow: () => ({ time: "9:41 AM", date: "07/21" }),
        getTimezoneOffset: () => 0,
    });

    const dangerous = '<img src=x onerror="globalThis.pwned=1">';
    const day = {
        day: dangerous,
        condition: dangerous,
        description: dangerous,
        conditionId: 500,
        high: 70,
        low: 55,
        precipitation: 2.54,
        rainChance: 40,
        windSpeed: 9,
    };
    forecast.render([day], 0);
    assert.doesNotMatch(strip.innerHTML, /<img src=x onerror=/);
    assert.match(strip.innerHTML, /&lt;img src=x onerror=&quot;globalThis\.pwned=1&quot;&gt;/);

    dayCard.dispatch("click");
    assert.doesNotMatch(panel.innerHTML, /<img src=x onerror=/);
    assert.match(panel.innerHTML, /&lt;img src=x onerror=&quot;globalThis\.pwned=1&quot;&gt;/);
    assert.equal(panel.classList.contains("hidden"), false);

    const event = { key: "ArrowRight", preventDefault() {} };
    forecast.onTabKeydown(event, "today");
    assert.equal(forecast.isForecastTabActive(), true);
    assert.equal(document.activeElement, document.getElementById("tabForecast"));

    mobile = true;
    dayCard.dispatch("click");
    assert.equal(inlineDetail.hidden, false);
    assert.equal(dayCard.classList.contains("open"), true);
    assert.equal(refreshed.at(-1), 500);
});

test("alerts encode request coordinates, render trusted icons, trap focus, and close", async () => {
    const document = documentStub();
    const overlay = document.getElementById("alertOverlay");
    overlay.classList.add("hidden");
    overlay.hidden = true;
    const detail = document.getElementById("alertDetail");
    detail.classList.add("hidden");
    detail.hidden = true;
    document.getElementById("alertBadge").classList.add("hidden");

    const urls = [];
    const alert = {
        id: "alert-1",
        event: "Tornado Warning",
        tier: "warning",
        areaDesc: "Queens; Kings",
        ends: 100,
        expires: 100,
        senderName: "NWS New York",
        description: "Take shelter now.",
        instruction: "Move to an interior room.",
        autoPop: true,
    };
    const context = runClassicScript("public/alerts.js", {
        document,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, json: async () => ({ alerts: [alert] }) };
        },
    });
    const alerts = lexical(context, "CirrusAlerts");
    alerts.init({
        backendUrl: "https://cirrus-project1.duckdns.org",
        show: (id) => document.getElementById(id).classList.remove("hidden"),
        hide: (id) => document.getElementById(id).classList.add("hidden"),
        set: (id, value) => { document.getElementById(id).textContent = value; },
        getTimezoneOffset: () => 0,
        formatCityTime: () => "10:00 PM",
        prefersReducedMotion: () => true,
        onAlertsChanged: () => {},
        allowAutoPop: () => true,
    });

    await alerts.checkAlerts({ lat: "1&admin=true", lon: "2 3" });
    assert.equal(
        urls[0],
        "https://cirrus-project1.duckdns.org/alerts?lat=1%26admin%3Dtrue&lon=2%203"
    );
    assert.equal(overlay.classList.contains("hidden"), false);
    assert.equal(alerts.getStormLightningRank(), "severe");

    const strip = document.getElementById("alertStrip");
    assert.equal(strip.children.length, 4);
    strip.children.forEach((segment) => {
        assert.match(segment.children[0].innerHTML, /^<svg class="alert-seg-ic"/);
    });

    const channels = document.getElementById("alertChannels");
    channels.children[0].dispatch("click");
    assert.equal(detail.hidden, false);
    assert.equal(document.getElementById("alertDetailBody").children[0].textContent, "Tornado Warning");

    const close = document.getElementById("alertClose");
    const back = document.getElementById("alertBack");
    overlay.querySelectorAll = () => [close, back];
    back.focus();
    document.dispatch("keydown", { key: "Tab", shiftKey: false, preventDefault() {} });
    assert.equal(document.activeElement, close);

    close.dispatch("click");
    assert.equal(overlay.hidden, true);
});

test("desktop channels render, enter and leave takeovers, and submit searches", () => {
    const document = documentStub();
    const target = element(document, "target");
    target.dataset.channelTarget = "0";
    const dayTiles = Array.from({ length: 5 }, () => {
        const tile = element(document, "dayTile");
        const children = new Map([
            [".channel-day-label", element(document)],
            [".channel-day-icon", element(document)],
            [".channel-day-high", element(document)],
            [".channel-day-low", element(document)],
        ]);
        tile.querySelector = (selector) => children.get(selector) || null;
        return tile;
    });
    document.querySelectorAll = (selector) => {
        if (selector === "[data-channel-target]") {
            return [target];
        }
        if (selector === ".channel-tile--day") {
            return dayTiles;
        }
        return [];
    };

    const searches = [];
    const refreshed = [];
    const context = runClassicScript("public/channels.js", {
        document,
        iconMap: { 800: "clear-day.png", 500: "rain.png" },
        window: {
            matchMedia: () => ({ matches: true, addEventListener() {} }),
            requestAnimationFrame: (callback) => callback(),
            setInterval: () => 1,
            clearInterval: () => {},
        },
    });
    const channels = lexical(context, "CirrusDesktopChannels");
    channels.init({
        formatCityNow: () => ({ time: "9:41 AM", date: "07/21" }),
        degreesToCompass: () => "NE",
        refreshAtmosphere: (id) => refreshed.push(id),
        onSearch: (city) => searches.push(city),
    });

    const weather = {
        city: "New York",
        temperature: 72,
        tempMax: 75,
        tempMin: 61,
        condition: "clear sky",
        description: "clear sky",
        conditionId: 800,
        weatherCode: "01d",
        windDeg: 45,
        windSpeed: 8,
        humidity: 50,
        visibility: 16093.4,
        timezoneOffset: 0,
    };
    const forecast = Array.from({ length: 5 }, (_, index) => ({
        day: `Day ${index + 1}`,
        condition: "rain",
        description: "light rain",
        conditionId: 500,
        high: 70 + index,
        low: 55 + index,
        precipitation: 2.54,
        rainChance: 40,
        windSpeed: 9,
    }));
    channels.render(weather, forecast);
    assert.equal(document.getElementById("channelTodayTitle").textContent, "Today Channel · New York");

    target.dispatch("click");
    assert.equal(document.getElementById("channelGridWrap").classList.contains("hidden"), true);
    assert.equal(document.getElementById("channelTakeover").classList.contains("hidden"), false);
    assert.match(document.getElementById("channelTakeoverTitle").textContent, /DAY 1/);

    document.getElementById("channelBack").dispatch("click");
    assert.equal(document.getElementById("channelGridWrap").classList.contains("hidden"), false);
    assert.equal(refreshed.at(-1), 800);

    document.getElementById("desktopCityInput").value = "  Boston  ";
    document.getElementById("desktopSearchButton").dispatch("click");
    assert.deepEqual(searches, ["Boston"]);
    channels.setSearching(true);
    assert.equal(document.getElementById("desktopSearchButton").getAttribute("aria-busy"), "true");
});

test("main script uses fixed backend paths and exercises loading, history, and render flows", async () => {
    const document = documentStub();
    document.getElementById("weatherDisplay").classList.add("hidden");
    document.getElementById("todayEmpty").classList.add("hidden");
    const localStorage = storageStub({ cirrus_city_history: JSON.stringify(["Boston", "Chicago"]) });
    const urls = [];
    const weather = {
        city: "New York",
        temperature: 72,
        feelsLike: 70,
        humidity: 50,
        condition: "clear sky",
        windSpeed: 8,
        weatherCode: "01d",
        conditionId: 800,
        windDeg: 45,
        description: "clear sky",
        visibility: 16093.4,
        cloudCover: 10,
        pressure: 1013,
        sunrise: 100,
        sunset: 200,
        tempMin: 61,
        tempMax: 75,
        lat: 40.7,
        lon: -74,
        timezoneOffset: 0,
    };
    const forecastDays = Array.from({ length: 5 }, () => ({ day: "Tue" }));
    const calls = { alertChecks: 0, atmosphere: 0, channelRenders: 0, forecastRenders: 0 };
    const cirrusForecast = {
        init() {},
        isForecastTabActive: () => true,
        updateForecastEmptyState() {},
        prepareSearch() {},
        render: () => { calls.forecastRenders += 1; },
    };
    const context = runClassicScript("public/script.js", {
        console: quietConsole,
        document,
        localStorage,
        location: { hostname: "june.github.io" },
        navigator: { onLine: true },
        fetch: async (url) => {
            urls.push(url);
            if (url.endsWith("/health")) {
                return { ok: true, json: async () => ({ ok: true }) };
            }
            if (url.includes("/weather?")) {
                return { ok: true, json: async () => weather };
            }
            return { ok: true, json: async () => forecastDays };
        },
        Image: class {
            set src(value) { this._src = value; }
            get src() { return this._src; }
        },
        iconMap: { 800: "clear-day.png" },
        CirrusSearchUI: { init() {}, setSearching() {}, playPressGlow() {} },
        CirrusAlerts: {
            init() {},
            resetForSearch() {},
            checkAlerts: () => { calls.alertChecks += 1; },
            syncOverlay() {},
        },
        CirrusAtmosphere: {
            clear() {},
            refresh: () => { calls.atmosphere += 1; },
        },
        CirrusForecast: cirrusForecast,
        CirrusDesktopChannels: {
            init() {},
            setSearching() {},
            setGlobeImage() {},
            render: () => { calls.channelRenders += 1; },
        },
        window: { matchMedia: () => ({ matches: true }) },
        setTimeout: () => 1,
        clearTimeout: () => {},
        setInterval: () => 2,
        clearInterval: () => {},
    });

    const weatherResult = await lexical(context, 'fetchWeatherData("New York & Co")');
    assert.equal(weatherResult.city, "New York");
    assert.equal(
        urls[1],
        "https://cirrus-project1.duckdns.org/weather?city=New%20York%20%26%20Co"
    );

    const history = document.getElementById("historyList");
    assert.deepEqual(history.children.map((child) => child.textContent), ["Boston", "Chicago"]);

    for (const [status, message] of [
        [404, "City not found — check the spelling and try again."],
        [429, "Too many searches — please wait a minute and try again."],
        [500, "Server error — try again in a moment."],
    ]) {
        context.errorResponse = { status, json: async () => ({}) };
        assert.equal(await lexical(context, "readBackendError(errorResponse)"), message);
    }

    context.weatherFixture = weather;
    context.forecastFixture = forecastDays;
    lexical(context, 'completeForecastLoad("new york", weatherFixture, forecastFixture, { showToday: true, renderChannels: true })');
    assert.equal(calls.forecastRenders, 1);
    assert.equal(calls.channelRenders, 1);
    assert.equal(calls.alertChecks, 1);
    assert.equal(calls.atmosphere, 1);
    assert.equal(document.getElementById("cityName").textContent, "New York");
    context.shortForecast = forecastDays.slice(0, 4);
    assert.throws(
        () => lexical(context, 'completeForecastLoad("new york", weatherFixture, shortForecast, { renderChannels: true })'),
        /Forecast data is incomplete\./
    );

    context.successTask = async () => {};
    await lexical(context, "withLoading(successTask)");
    assert.equal(document.getElementById("weatherDisplay").classList.contains("hidden"), false);

    context.failureTask = async () => { throw new Error("network down"); };
    await lexical(context, "withLoading(failureTask)");
    assert.equal(document.getElementById("errorMsg").textContent, "network down");
    assert.equal(document.getElementById("loading").classList.contains("hidden"), true);

    assert.equal(lexical(context, "getFeelsLikeExplanation(70, 63, 12, 50)"), "Feels colder due to wind");
    assert.equal(lexical(context, "getFeelsLikeExplanation(70, 74, 2, 80)"), "Feels warmer due to humidity");
});

test("lightning and rain controllers honor active, stopped, and reduced-motion states", async () => {
    const lightningDocument = documentStub();
    const lightningLayer = lightningDocument.getElementById("atmoLightningLayer");
    lightningLayer.classList.add("is-hidden");
    let reducedMotion = false;
    const lightningContext = runClassicScript("public/atmo-lightning.js", {
        document: lightningDocument,
        window: {
            matchMedia: () => ({ matches: reducedMotion }),
            setTimeout: () => 1,
            clearTimeout: () => {},
        },
        Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    });
    const lightning = lexical(lightningContext, "AtmoLightning");
    lightning.start("severe");
    assert.equal(lightningLayer.classList.contains("is-hidden"), false);
    lightning.stop();
    assert.equal(lightningLayer.classList.contains("is-hidden"), true);
    reducedMotion = true;
    lightning.start("normal");
    assert.equal(lightningLayer.classList.contains("is-hidden"), true);

    const missingLightning = runClassicScript("public/atmo-lightning.js", {
        document: { getElementById: () => null, createElement: () => { throw new Error("not reached"); } },
        window: { matchMedia: () => ({ matches: false }), setTimeout: () => 1, clearTimeout: () => {} },
    });
    assert.doesNotThrow(() => lexical(missingLightning, 'AtmoLightning.start("normal")'));

    const rainDocument = documentStub();
    const video = rainDocument.getElementById("atmoRainVideo");
    video.classList.add("is-hidden");
    let played = 0;
    let paused = 0;
    video.play = () => { played += 1; return Promise.resolve(); };
    video.pause = () => { paused += 1; };
    let rainReducedMotion = false;
    const rainContext = runClassicScript("public/atmo-rain-video.js", {
        document: rainDocument,
        window: {
            matchMedia: (query) => ({
                matches: query.includes("prefers-reduced-motion")
                    ? rainReducedMotion
                    : query.includes("max-width"),
            }),
        },
    });
    const rain = lexical(rainContext, "AtmoRainVideo");
    rain.start("rain-heavy");
    await Promise.resolve();
    assert.equal(video.style.opacity, String(0.13 * 1.35));
    assert.equal(played, 1);
    rain.stop();
    assert.equal(paused, 1);
    assert.equal(video.currentTime, 0);
    assert.equal(video.classList.contains("is-hidden"), true);
    rainReducedMotion = true;
    rain.start("rain");
    assert.equal(played, 1);
    assert.equal(paused, 2);

    const missingRain = runClassicScript("public/atmo-rain-video.js", {
        document: { getElementById: () => null, addEventListener() {} },
        window: { matchMedia: () => ({ matches: false }) },
    });
    assert.doesNotThrow(() => lexical(missingRain, 'AtmoRainVideo.start("rain")'));
});
