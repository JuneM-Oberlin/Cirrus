const assert = require("node:assert/strict");
const test = require("node:test");
const {
    quietConsole,
    element,
    documentStub,
    storageStub,
    runClassicScript,
    lexical,
} = require("./helpers");

// A frame button stub with the .frame-btn-label child frame.js writes into.
function frameButton(document, id) {
    const button = document.getElementById(id);
    const label = element(document, id + "Label");
    button.querySelector = (selector) => {
        if (selector === ".frame-btn-label") {
            return label;
        }
        return null;
    };
    button.label = label;
    return button;
}

function frameDocument(viewIds) {
    const document = documentStub();
    const views = viewIds.map((id) => {
        const view = element(document, "view-" + id);
        view.dataset.view = id;
        return view;
    });
    ["navUp", "navDown", "backButton", "settingsButton", "globeButton"].forEach((id) => frameButton(document, id));
    document.querySelectorAll = (selector) => {
        if (selector === ".view[data-view]") {
            return views;
        }
        return [];
    };
    return { document, views };
}

// The real feel settings, as the page loads them before frame.js.
const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

function loadFrame(viewIds, { desktop = false } = {}) {
    const { document, views } = frameDocument(viewIds);
    const context = runClassicScript("public/frame.js", {
        CirrusConfig,
        document,
        window: { matchMedia: () => ({ matches: desktop, addEventListener() {} }) },
        getComputedStyle: () => ({ getPropertyValue: () => "350ms" }),
        setInterval: () => 1,
    });
    return { document, views, frame: lexical(context, "CirrusFrame") };
}

test("units format temperatures, wind, and Wii-style times, and remember settings", () => {
    const localStorage = storageStub();
    const context = runClassicScript("public/units.js", { console: quietConsole, localStorage });
    const units = lexical(context, "CirrusUnits");

    assert.equal(units.temp(68.4), "68°");
    assert.equal(units.wind(10.2), "10 mph");
    assert.equal(units.distance(6.21), "6.2 mi");
    assert.equal(units.precip(0), "0 in");

    // 23:46 UTC in a city at UTC-5 is 6:46 p.m. local time on 10/21.
    assert.equal(units.asOf(Date.UTC(2026, 9, 21, 23, 46), -5 * 3600), "As of 6:46 p.m., 10/21");
    assert.equal(units.clockTime(new Date(Date.UTC(2026, 0, 1, 0, 5))), "12:05 a.m.");
    assert.equal(units.clockTime(new Date(Date.UTC(2026, 0, 1, 12, 0))), "12:00 p.m.");

    const seen = [];
    units.onChange((settings) => seen.push(settings.temp));
    units.update({ temp: "C", wind: "kmh" });
    assert.equal(units.temp(68), "20°C");
    assert.equal(units.wind(10), "16 km/h");
    assert.equal(units.distance(1), "1.6 km");
    assert.deepEqual(seen, ["C"]);
    assert.equal(localStorage.getItem("cirrus_units"), JSON.stringify({ temp: "C", wind: "kmh" }));

    // a fresh page load reads the saved choice back
    const reloaded = runClassicScript("public/units.js", { console: quietConsole, localStorage });
    assert.equal(lexical(reloaded, "CirrusUnits").temp(32), "0°C");
});

test("frame steps through the view stack and names each neighbour", () => {
    const { document, views, frame } = loadFrame(["uv", "current", "today"]);
    const changes = [];
    frame.init({ onViewChange: (id) => changes.push(id) });

    // starts on Current, with UV Index above and Today below
    assert.equal(document.getElementById("frameTitle").textContent, "Current");
    assert.equal(document.getElementById("navUp").label.textContent, "UV Index");
    assert.equal(document.getElementById("navDown").label.textContent, "Today");
    assert.equal(views[1].inert, false);
    assert.equal(views[0].inert, true);

    frame.next();
    assert.equal(frame.currentViewId(), "today");
    assert.equal(document.getElementById("navDown").disabled, true, "last view has an empty bottom slot");
    assert.equal(document.getElementById("navDown").classList.contains("is-empty"), true);

    frame.prev();
    frame.prev();
    assert.equal(frame.currentViewId(), "uv");
    assert.equal(document.getElementById("navUp").disabled, true, "first view has an empty top slot");
    assert.deepEqual(changes, ["today", "current", "uv"]);

    // a view can retitle the header without renaming its neighbour button
    frame.setViewTitle("today", "Thursday");
    frame.showView("current");
    assert.equal(document.getElementById("navDown").label.textContent, "Today");
    frame.showView("today");
    assert.equal(document.getElementById("frameTitle").textContent, "Thursday");
});

test("scrolling over the frame moves one view per flick", () => {
    const { document, frame } = loadFrame(["uv", "current", "today", "tomorrow"]);
    frame.init({});
    document.getElementById("alertOverlay").classList.add("hidden");
    const frameElement = document.getElementById("frame");
    let blocked = 0;
    function scroll(deltaY, timeStamp, extra = {}) {
        frameElement.dispatch("wheel", {
            deltaX: 0,
            deltaY,
            deltaMode: 0,
            timeStamp,
            preventDefault: () => { blocked += 1; },
            ...extra,
        });
    }

    // one mouse notch down moves from Current to Today
    scroll(100, 1000);
    assert.equal(frame.currentViewId(), "today");

    // a trackpad's fading scrolls after the flick don't move again
    scroll(60, 1016);
    scroll(30, 1032);
    scroll(10, 1048);
    assert.equal(frame.currentViewId(), "today");

    // a clearly bigger push is a new flick
    scroll(90, 1500);
    assert.equal(frame.currentViewId(), "tomorrow");

    // after a quiet gap, small scrolls add up before moving back up
    scroll(-20, 2000);
    assert.equal(frame.currentViewId(), "tomorrow");
    scroll(-25, 2016);
    assert.equal(frame.currentViewId(), "today");

    // pinch zoom (ctrl + wheel) and sideways scrolls are left alone
    const before = blocked;
    scroll(100, 3000, { ctrlKey: true });
    scroll(10, 3500, { deltaX: 80 });
    assert.equal(frame.currentViewId(), "today");
    assert.equal(blocked, before);

    // at the first view, scrolling further up is left to the page
    frame.showView("uv");
    const atTop = blocked;
    scroll(-100, 4000);
    assert.equal(frame.currentViewId(), "uv");
    assert.equal(blocked, atTop);

    // screens like Settings scroll on their own
    frame.showView("current");
    frame.openScreen("settings", { title: "Settings" });
    scroll(100, 5000);
    assert.equal(frame.screenName(), "settings");

    frame.closeScreen();

    // a slow mouse notch on a Mac is only 4px, but it is still one notch
    scroll(4, 6000, { wheelDeltaY: -120 });
    assert.equal(frame.currentViewId(), "today");
    scroll(4, 6300, { wheelDeltaY: -120 });
    assert.equal(frame.currentViewId(), "tomorrow");
    scroll(-4, 6600, { wheelDeltaY: 120 });
    assert.equal(frame.currentViewId(), "today");
});

test("a trackpad still gliding when a screen closes doesn't move a view", () => {
    const { document, frame } = loadFrame(["uv", "current", "today", "tomorrow"]);
    frame.init({});
    document.getElementById("alertOverlay").classList.add("hidden");
    const frameElement = document.getElementById("frame");
    function scroll(deltaY, timeStamp) {
        frameElement.dispatch("wheel", { deltaX: 0, deltaY, deltaMode: 0, timeStamp, preventDefault() {} });
    }

    // a fresh page: flick the Settings cards, then close Settings mid-glide
    frame.openScreen("settings", { title: "Settings" });
    [[20, 1000], [45, 1016], [60, 1032], [55, 1048], [50, 1064], [45, 1080], [40, 1096]].forEach(([size, at]) => scroll(size, at));
    frame.closeScreen();
    [[36, 1112], [32, 1128], [29, 1144], [26, 1160], [23, 1176], [21, 1192], [19, 1208]].forEach(([size, at]) => scroll(size, at));
    assert.equal(frame.currentViewId(), "current");

    // once the glide has gone quiet, scrolling works again
    scroll(60, 2000);
    assert.equal(frame.currentViewId(), "today");
});

test("a single bump in a trackpad's fading scroll doesn't skip a view", () => {
    const { document, frame } = loadFrame(["uv", "current", "today", "tomorrow"]);
    frame.init({});
    document.getElementById("alertOverlay").classList.add("hidden");
    const frameElement = document.getElementById("frame");
    function scroll(deltaY, timeStamp) {
        frameElement.dispatch("wheel", { deltaX: 0, deltaY, deltaMode: 0, timeStamp, preventDefault() {} });
    }

    scroll(60, 10000);
    assert.equal(frame.currentViewId(), "today");
    // the flick fades out...
    [[50, 10016], [40, 10032], [30, 10048], [20, 10064], [14, 10100], [14, 10150],
        [13, 10200], [13, 10250], [12, 10300], [12, 10350], [12, 10400]].forEach(([size, at]) => scroll(size, at));
    // ...and two scrolls merged into one while the page was busy
    scroll(27, 10420);
    scroll(13, 10440);
    assert.equal(frame.currentViewId(), "today");

    // a real second flick grows over several scrolls and does move
    scroll(25, 10460);
    scroll(40, 10476);
    assert.equal(frame.currentViewId(), "tomorrow");
});

test("page dots show where you are and jump straight to a view", () => {
    const { document, frame } = loadFrame(["uv", "current", "today", "fiveday"]);
    frame.init({});
    const dots = document.getElementById("viewDots").children;

    assert.equal(dots.length, 4, "one dot per view");
    assert.equal(dots[1].getAttribute("aria-label"), "Current");
    assert.equal(dots[1].getAttribute("aria-current"), "true");
    assert.equal(dots[1].tabIndex, 0, "only the current dot is in the Tab order");
    assert.equal(dots[0].tabIndex, -1);

    dots[3].dispatch("click");
    assert.equal(frame.currentViewId(), "fiveday");
    assert.equal(dots[3].classList.contains("is-current"), true);
    assert.equal(dots[1].getAttribute("aria-current"), null);
    assert.equal(document.getElementById("frameTitle").textContent, "5-Day Forecast");
});

test("frame screens take over the title, show Back, and restore the view on close", () => {
    const { document, frame } = loadFrame(["current", "today"]);
    frame.init({});
    let closed = 0;
    frame.openScreen("search", { title: "Location", onClose: () => { closed += 1; } });

    assert.equal(document.getElementById("frameTitle").textContent, "Location");
    assert.equal(document.getElementById("backButton").label.textContent, "Back");
    assert.equal(document.getElementById("navDown").disabled, true, "stepping is paused on a screen");
    assert.equal(frame.screenName(), "search");

    frame.back();
    assert.equal(closed, 1);
    assert.equal(frame.screenName(), null);
    assert.equal(document.getElementById("frameTitle").textContent, "Current");
    assert.equal(document.getElementById("navDown").label.textContent, "Today");
});

test("frame shows Home only on desktop and renders the wind readout", () => {
    const mobile = loadFrame(["current"]);
    mobile.frame.init({ onHome: () => {} });
    assert.equal(mobile.document.getElementById("backButton").disabled, true);

    const desktop = loadFrame(["current"], { desktop: true });
    let homes = 0;
    desktop.frame.init({ onHome: () => { homes += 1; } });
    assert.equal(desktop.document.getElementById("backButton").label.textContent, "Home");
    desktop.frame.back();
    assert.equal(homes, 1);

    desktop.frame.setReadout("current", {
        main: "WSW 3 mph",
        stats: [{ text: "Humidity 36%" }, { text: "Clouds 93%" }],
    });
    // the footer carries only the wind line; readings live in the view's bubbles
    assert.equal(desktop.document.getElementById("panelWindMain").textContent, "WSW 3 mph");
    assert.equal(desktop.document.getElementById("panelWind").classList.contains("hidden"), false);

    desktop.frame.setAsOf("As of 6:46 p.m., 10/21");
    assert.equal(desktop.document.getElementById("panelAsOf").textContent, "As of 6:46 p.m., 10/21");
});

test("desktop Home tiles open the frame and the letterbox submits searches", () => {
    const document = documentStub();
    const todayTile = element(document, "todayTile");
    todayTile.dataset.channelTarget = "today";
    const dayTile = element(document, "dayTile");
    dayTile.dataset.channelTarget = "1";
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
            return [todayTile, dayTile];
        }
        if (selector === ".channel-tile--day") {
            return dayTiles;
        }
        return [];
    };

    const opened = [];
    const searches = [];
    const context = runClassicScript("public/channels.js", {
        document,
        iconMap: { 800: "clear-day.png", 500: "rain.png" },
        window: {
            matchMedia: () => ({ matches: true, addEventListener() {} }),
            setInterval: () => 1,
            clearInterval: () => {},
        },
    });
    const channels = lexical(context, "CirrusDesktopChannels");
    channels.init({
        formatTemp: (f) => Math.round(f) + "°",
        formatAsOf: () => "As of 9:41 a.m., 07/21",
        onSearch: (city) => searches.push(city),
        onOpenChannel: (target) => opened.push(target),
    });

    todayTile.dispatch("click");
    assert.deepEqual(opened, [], "tiles do nothing before a city loads");
    assert.equal(document.getElementById("channelAsOf").textContent, "As of --:--");

    const weather = {
        city: "New York",
        temperature: 72,
        condition: "clear sky",
        description: "clear sky",
        conditionId: 800,
        weatherCode: "01d",
        timezoneOffset: 0,
    };
    const forecast = Array.from({ length: 5 }, (_, index) => ({
        day: `Day ${index + 1}`,
        condition: "rain",
        conditionId: 500,
        high: 70 + index,
        low: 55 + index,
    }));
    channels.render(weather, forecast);
    assert.equal(document.getElementById("channelTodayTitle").textContent, "Today Channel · New York");
    assert.equal(document.getElementById("channelAsOf").textContent, "As of 9:41 a.m., 07/21");

    todayTile.dispatch("click");
    dayTile.dispatch("click");
    assert.deepEqual(opened, ["today", 1]);

    document.getElementById("desktopCityInput").value = "  Boston  ";
    document.getElementById("desktopSearchButton").dispatch("click");
    assert.deepEqual(searches, ["Boston"]);
    channels.setSearching(true);
    assert.equal(document.getElementById("desktopSearchButton").getAttribute("aria-busy"), "true");
});

test("app glue uses fixed backend paths, loads a city into every module, and reports errors", async () => {
    const document = documentStub();
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
    let failNext = false;
    const calls = { renders: 0, alerts: 0, atmosphere: 0, channels: 0, recents: 0, locations: [], uv: [] };
    const noop = () => {};
    const context = runClassicScript("public/script.js", {
        console: quietConsole,
        document,
        localStorage,
        location: { hostname: "june.github.io" },
        navigator: { onLine: true },
        fetch: async (url) => {
            urls.push(url);
            if (failNext && url.includes("/weather?")) {
                return { ok: false, status: 404, json: async () => ({}) };
            }
            if (url.includes("/weather?")) {
                return { ok: true, json: async () => weather };
            }
            if (url.includes("/uv?")) {
                return { ok: true, json: async () => ({ value: 4.8, category: "Moderate" }) };
            }
            return { ok: true, json: async () => forecastDays };
        },
        Image: class {
            set src(value) { this._src = value; }
            get src() { return this._src; }
        },
        CirrusUnits: { temp: (f) => f + "°", asOf: () => "As of", cityClockTime: () => "--", onChange: noop },
        CirrusSettings: { init: noop },
        CirrusFeel: { init: noop, shake: noop },
        CirrusSound: { init: noop, play: noop },
        CirrusPointer: { init: noop },
        CirrusIdle: { init: noop },
        CirrusEggs: { init: noop, setWeather: noop },
        CirrusLaunch: { playIntro: noop, openFrom: (tile, show) => show(), closeTo: (hide) => hide() },
        CirrusConfig,
        CirrusPlaces: lexical(runClassicScript("public/places.js"), "CirrusPlaces"),
        CirrusFrame: { init: noop, showView: noop, hasView: () => false, setVisiting: noop, setHandlers: noop, currentViewId: () => "current" },
        CirrusCountUp: { playIn: noop },
        CirrusGlobe: { init: noop },
        CirrusViews: {
            init: noop,
            showEmpty: noop,
            render: () => { calls.renders += 1; },
            renderUv: (uv) => calls.uv.push(uv),
        },
        CirrusSearch: {
            init: noop,
            open: noop,
            close: noop,
            isOpen: () => false,
            setLocation: (name) => calls.locations.push(name),
            renderRecents: () => { calls.recents += 1; },
        },
        CirrusAlerts: { init: noop, resetForSearch: noop, checkAlerts: () => { calls.alerts += 1; } },
        CirrusAtmosphere: { clear: noop, refresh: () => { calls.atmosphere += 1; } },
        CirrusDesktopChannels: { init: noop, setSearching: noop, render: () => { calls.channels += 1; } },
        window: { matchMedia: () => ({ matches: false }) },
        setTimeout: () => 1,
        clearTimeout: noop,
        setInterval: () => 2,
        clearInterval: noop,
    });

    // start-up loads the most recent city
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(urls[0], "https://cirrus-project1.duckdns.org/health");
    assert.equal(urls[1], "https://cirrus-project1.duckdns.org/weather?city=Boston");

    const ok = await lexical(context, 'loadCity("New York & Co")');
    assert.equal(ok, true);
    assert.ok(urls.includes("https://cirrus-project1.duckdns.org/weather?city=New%20York%20%26%20Co"));
    assert.equal(calls.renders, 2);
    assert.equal(calls.channels, 2);
    assert.equal(calls.alerts, 2);
    assert.equal(calls.locations.at(-1), "New York");
    assert.ok(urls.includes("https://cirrus-project1.duckdns.org/sixhour?city=New%20York%20%26%20Co"));
    assert.ok(urls.includes("https://cirrus-project1.duckdns.org/uv?lat=40.7&lon=-74"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.uv.at(-1), { value: 4.8, category: "Moderate" });
    assert.deepEqual(JSON.parse(localStorage.getItem("cirrus_city_history")).slice(0, 2), ["New York & Co", "Boston"]);

    for (const [status, message] of [
        [404, "Couldn't find that town. Try another spelling?"],
        [429, "Whoa, that's a lot of searches! Take a short breather and try again in a minute."],
        [500, "The weather station is having a moment. Try again shortly?"],
    ]) {
        context.errorResponse = { status, json: async () => ({}) };
        assert.equal(await lexical(context, "readBackendError(errorResponse)"), message);
    }

    failNext = true;
    const failed = await lexical(context, 'loadCity("Nowhere")');
    assert.equal(failed, false);
    assert.equal(document.getElementById("errorMsg").textContent, "Couldn't find that town. Try another spelling?");
    assert.equal(document.getElementById("errorMsg").classList.contains("hidden"), false);
    assert.equal(document.getElementById("loading").classList.contains("hidden"), true);
    assert.equal(document.getElementById("errorCard").classList.contains("hidden"), false, "the error card shows");
    assert.equal(lexical(context, "lastFailure.status"), 404, "Try again knows it was a misspelling");

    // typing a new spelling clears the card
    document.getElementById("cityInput").dispatch("input");
    assert.equal(document.getElementById("errorCard").classList.contains("hidden"), true);
});

test("views fill Current, Today, and Tomorrow and hand readouts to the frame", () => {
    const document = documentStub();
    const readouts = {};
    let asOf = "";
    const frame = {
        setReadout: (id, readout) => { readouts[id] = readout; },
        setAsOf: (text) => { asOf = text; },
        setViewTitle() {},
    };
    const unitsContext = runClassicScript("public/units.js", { console: quietConsole, localStorage: storageStub() });
    const context = runClassicScript("public/views.js", {
        document,
        iconMap: { 803: "partly-cloudy-day.png", "804n": "mostly-cloudy-night.png", 804: "mostly-cloudy-day.png" },
    });
    const views = lexical(context, "CirrusViews");
    views.init({ frame, units: lexical(unitsContext, "CirrusUnits") });

    views.render({
        loadedAt: Date.UTC(2026, 9, 22, 1, 30),
        weather: {
            temperature: 69.4, feelsLike: 67.8, humidity: 36, condition: "overcast clouds",
            description: "overcast clouds", windSpeed: 3, windDeg: 237, weatherCode: "04n",
            conditionId: 804, visibility: 10000, cloudCover: 93, pressure: 1018,
            sunrise: 1792588580, sunset: 1792627946, timezoneOffset: -21600,
        },
        forecast: [
            { high: 73.3, low: 55.3, condition: "broken clouds", conditionId: 803, windSpeed: 2.3, rainChance: 0, precipitation: 0 },
            { high: 79.6, low: 62.5, condition: "overcast clouds", conditionId: 804, windSpeed: 10.6, rainChance: 15, precipitation: 0.254 },
        ],
    });

    assert.equal(document.getElementById("framePanel").classList.contains("has-data"), true);
    assert.equal(document.getElementById("currentTemp").textContent, "69°");
    assert.equal(document.getElementById("currentCond").textContent, "Overcast Clouds");
    assert.equal(document.getElementById("currentIcon").src, "icons/mostly-cloudy-night.png", "night uses the moon icon");
    assert.equal(readouts.current.main, "WSW 3 mph");
    assert.equal(document.getElementById("todayHigh").textContent, "73°");
    assert.equal(document.getElementById("todayLow").textContent, "55°");
    assert.equal(document.getElementById("tomorrowIcon").src, "icons/mostly-cloudy-day.png", "forecast days use day icons");
    assert.equal(readouts.tomorrow.main, "Wind 11 mph");
    assert.equal(readouts.tomorrow.stats[0].text, "Chance of rain 15%");
    assert.equal(readouts.tomorrow.stats[1].text, "Precipitation 0.01 in");
    assert.equal(asOf, "As of 7:30 p.m., 10/21");

    // every icon gets a small idle motion picked from its picture
    assert.equal(document.getElementById("currentIcon").dataset.motion, "cloud");
    assert.equal(views.motionFor("icons/clear-day.png"), "sun");
    assert.equal(views.motionFor("icons/clear-night.png"), "moon");
    assert.equal(views.motionFor("icons/mostly-cloudy-with-rain-night.png"), "rain");
    assert.equal(views.motionFor("icons/partly-cloudy-with-snow-day.png"), "snow");
    assert.equal(views.motionFor("icons/fog.png"), "fog");

    // readings become bubbles inside the views, label first for screen readers
    const bubbles = document.getElementById("currentReadings").children;
    assert.equal(bubbles.length, 7, "all seven readings show, on phones too");
    const [icon, label, value] = bubbles[1].children;
    assert.equal(icon.getAttribute("class"), "reading-icon");
    assert.equal(label.textContent, "Humidity");
    assert.equal(value.textContent, "36%");
    assert.equal(document.getElementById("tomorrowReadings").children[0].children[2].textContent, "15%");

    views.showEmpty();
    assert.equal(document.getElementById("framePanel").classList.contains("has-data"), false);
    assert.equal(readouts.today, null);
});

test("the 5-day view builds five columns with weekend names marked", () => {
    const document = documentStub();
    const opened = [];
    const frame = {
        setReadout() {},
        setAsOf() {},
        setViewTitle() {},
        openScreen: (name, options) => opened.push([name, options.title]),
    };
    const unitsContext = runClassicScript("public/units.js", { console: quietConsole, localStorage: storageStub() });
    const context = runClassicScript("public/views.js", { document, iconMap: { 800: "clear-day.png" } });
    const views = lexical(context, "CirrusViews");
    views.init({ frame, units: lexical(unitsContext, "CirrusUnits") });

    const names = ["Fri", "Sat", "Sun", "Mon", "Tue"];
    const forecast = names.map((day, i) => ({
        day, high: 79 - i, low: 48 + i, condition: "<b>clear</b> sky", conditionId: 800, windSpeed: 5,
    }));
    views.render({ loadedAt: 0, weather: { temperature: 70, feelsLike: 70, condition: "clear", windDeg: 0,
        windSpeed: 1, weatherCode: "01d", conditionId: 800, visibility: 1000, pressure: 1000, timezoneOffset: 0 },
        forecast });

    const columns = document.getElementById("fivedayList").children.map((item) => item.children[0]);
    assert.equal(columns.length, 5);
    const [name, , high, low] = columns[1].children;
    assert.equal(name.textContent, "SAT");
    assert.equal(name.classList.contains("is-weekend"), true);
    assert.equal(columns[0].children[0].classList.contains("is-weekend"), false);
    assert.equal(high.textContent, "78");
    assert.equal(low.textContent, "49");
    assert.match(columns[1].getAttribute("aria-label"), /^Saturday: <b>clear<\/b> Sky, high 78°, low 49°/);

    columns[2].dispatch("click");
    assert.deepEqual(opened, [["day", "Sunday"]]);
    assert.equal(document.getElementById("dayHigh").textContent, "77°");
});

test("the 6-hour view shows tomorrow's four local blocks under tomorrow's weekday", () => {
    const document = documentStub();
    const titles = {};
    const frame = {
        setReadout() {},
        setAsOf() {},
        setViewTitle: (id, title) => { titles[id] = title; },
    };
    const unitsContext = runClassicScript("public/units.js", { console: quietConsole, localStorage: storageStub() });
    const context = runClassicScript("public/views.js", {
        document,
        iconMap: { 804: "mostly-cloudy-day.png", "804n": "mostly-cloudy-night.png" },
    });
    const views = lexical(context, "CirrusViews");
    views.init({ frame, units: lexical(unitsContext, "CirrusUnits") });

    const block = (date, day, startHour, code) => ({
        date, day, startHour, high: 66, low: 61, rainChance: 20,
        condition: "overcast clouds", conditionId: 804, weatherCode: code,
    });
    const sixHour = {
        timezoneOffset: -21600,
        blocks: [
            block("2026-10-21", "Wed", 18, "04n"),
            block("2026-10-22", "Thu", 0, "04n"),
            block("2026-10-22", "Thu", 6, "04d"),
            block("2026-10-22", "Thu", 12, "04d"),
            block("2026-10-22", "Thu", 18, "04n"),
            block("2026-10-23", "Fri", 0, "04n"),
        ],
    };
    // 01:30 UTC on 10/22 is 7:30 p.m. on 10/21 in Denver, so tomorrow is Thursday.
    views.render({
        loadedAt: Date.UTC(2026, 9, 22, 1, 30),
        weather: { temperature: 70, feelsLike: 70, condition: "clear", windDeg: 0, windSpeed: 1,
            weatherCode: "01n", conditionId: 800, visibility: 1000, pressure: 1000, timezoneOffset: -21600 },
        forecast: [],
        sixHour,
    });

    const tiles = document.getElementById("sixhourList").children;
    assert.equal(tiles.length, 4);
    assert.equal(titles.sixhour, "Thursday");
    assert.equal(tiles[0].children[2].textContent, "12:00 a.m. –\n6:00 a.m.");
    assert.equal(tiles[3].children[2].textContent, "6:00 p.m. –\n12:00 a.m.");
    assert.equal(tiles[0].children[0].src, "icons/mostly-cloudy-night.png");
    assert.equal(tiles[1].children[0].src, "icons/mostly-cloudy-day.png");
    assert.match(tiles[1].getAttribute("aria-label"), /^6:00 a\.m\. to 12:00 p\.m\.: Overcast Clouds, high 66°, low 61°, chance of rain 20%$/);
    assert.equal(document.getElementById("sixhourNote").classList.contains("hidden"), true);

    views.render({ loadedAt: 0, weather: { temperature: 70, feelsLike: 70, condition: "clear", windDeg: 0,
        windSpeed: 1, weatherCode: "01n", conditionId: 800, visibility: 1000, pressure: 1000, timezoneOffset: 0 },
        forecast: [], sixHour: null });
    assert.equal(document.getElementById("sixhourList").children.length, 0);
    assert.equal(document.getElementById("sixhourNote").classList.contains("hidden"), false);
});

test("settings switch units with buttons or arrow keys and remember the choice", () => {
    const document = documentStub();
    const localStorage = storageStub();
    const choice = (setting, value) => {
        const button = element(document, `${setting}-${value}`);
        button.dataset.setting = setting;
        button.dataset.value = value;
        return button;
    };
    const buttons = [choice("temp", "F"), choice("temp", "C"), choice("wind", "mph"), choice("wind", "kmh")];
    document.querySelectorAll = (selector) => {
        if (selector === ".settings-choice") {
            return buttons;
        }
        return [];
    };
    const unitsContext = runClassicScript("public/units.js", { console: quietConsole, localStorage });
    const units = lexical(unitsContext, "CirrusUnits");
    const screens = [];
    let handlers = {};
    const frame = {
        openScreen: (name, options) => screens.push([name, options.title]),
        setHandlers: (h) => { handlers = h; },
    };
    const context = runClassicScript("public/settings.js", { document });
    lexical(context, "CirrusSettings").init({ frame, units });

    assert.equal(buttons[0].getAttribute("aria-checked"), "true", "Fahrenheit is the default");
    assert.equal(buttons[0].tabIndex, 0);
    assert.equal(buttons[1].tabIndex, -1);

    handlers.onSettings();
    assert.deepEqual(screens, [["settings", "Settings"]]);
    assert.equal(document.activeElement, buttons[0]);

    buttons[1].dispatch("click");
    assert.equal(units.getSettings().temp, "C");
    assert.equal(buttons[1].getAttribute("aria-checked"), "true");
    assert.equal(buttons[0].getAttribute("aria-checked"), "false");

    buttons[2].dispatch("keydown", { key: "ArrowRight", preventDefault() {} });
    assert.equal(units.getSettings().wind, "kmh");
    assert.equal(document.activeElement, buttons[3]);
    assert.equal(localStorage.getItem("cirrus_units"), JSON.stringify({ temp: "C", wind: "kmh" }));
});

test("globe projection centres the look point and hides the far side", () => {
    const context = runClassicScript("public/globe.js", { document: documentStub() });
    const globe = lexical(context, "CirrusGlobe");
    const DEG = Math.PI / 180;
    // camera facing 40N 100W, disc centred at (500, 400), radius 300
    const cam = {
        radius: 300, cx: 500, cy: 400,
        sinLat0: Math.sin(40 * DEG), cosLat0: Math.cos(40 * DEG), lon0: -100,
    };

    const centre = globe.project(40, -100, cam);
    assert.equal(centre.visible, true);
    assert.ok(Math.abs(centre.x - 500) < 1e-9);
    assert.ok(Math.abs(centre.y - 400) < 1e-9);

    const north = globe.project(50, -100, cam);
    assert.ok(north.y < 400, "north of the centre is higher on screen");
    const east = globe.project(40, -90, cam);
    assert.ok(east.x > 500, "east of the centre is to the right");

    const farSide = globe.project(-40, 80, cam);
    assert.equal(farSide.visible, false, "the antipode is behind the globe");

    assert.equal(globe.nearestRegion(39.7, -105).id, "north-america");
    assert.equal(globe.nearestRegion(48.9, 2.3).id, "europe");
    assert.equal(globe.nearestRegion(-33.9, 151.2).id, "oceania");
    assert.equal(globe.nearestRegion(35.7, 139.7).id, "asia");
});

test("globe zoom levels blend evenly between steps and convert back", () => {
    const context = runClassicScript("public/globe.js", { document: documentStub() });
    const globe = lexical(context, "CirrusGlobe");
    const close = (a, b) => Math.abs(a - b) < 1e-9;

    // whole levels are the listed sizes
    assert.ok(close(globe.shareFor(0), 0.42));
    assert.ok(close(globe.shareFor(2), 1.35));
    assert.ok(close(globe.shareFor(5), 5.6));
    assert.ok(close(globe.shareFor(9), 40));
    // halfway between two levels grows by the same factor on each side
    const half = globe.shareFor(2.5);
    assert.ok(close(half / 1.35, 2.2 / half));

    // a pinch's size turns back into the same level, clamped at the ends
    [0, 0.3, 1.75, 2.5, 4.9, 6.5, 8.75].forEach((level) => {
        assert.ok(close(globe.levelForShare(globe.shareFor(level)), level), "level " + level);
    });
    assert.equal(globe.levelForShare(0.1), 0);
    assert.equal(globe.levelForShare(400), 11);
    // a level a hair outside the range still gives a real size
    assert.ok(close(globe.shareFor(-0.06), 0.42));
    assert.ok(close(globe.shareFor(11.2), 100));
});
