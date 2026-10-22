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

function loadFrame(viewIds, { desktop = false } = {}) {
    const { document, views } = frameDocument(viewIds);
    const context = runClassicScript("public/frame.js", {
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

    frame.setViewTitle("today", "Thursday");
    frame.showView("current");
    assert.equal(document.getElementById("navDown").label.textContent, "Thursday");
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
        stats: [{ text: "Humidity 36%" }, { text: "Clouds 93%", extra: true }],
    });
    const sub = desktop.document.getElementById("panelWindSub");
    assert.equal(desktop.document.getElementById("panelWindMain").textContent, "WSW 3 mph");
    assert.equal(sub.children.length, 2);
    assert.equal(sub.children[1].classList.contains("panel-stat--extra"), true);
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
    const calls = { renders: 0, alerts: 0, atmosphere: 0, channels: 0, recents: 0, locations: [] };
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
            return { ok: true, json: async () => forecastDays };
        },
        Image: class {
            set src(value) { this._src = value; }
            get src() { return this._src; }
        },
        CirrusUnits: { temp: (f) => f + "°", asOf: () => "As of", cityClockTime: () => "--" },
        CirrusFrame: { init: noop, showView: noop, hasView: () => false },
        CirrusViews: { init: noop, showEmpty: noop, render: () => { calls.renders += 1; } },
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
    assert.deepEqual(JSON.parse(localStorage.getItem("cirrus_city_history")).slice(0, 2), ["New York & Co", "Boston"]);

    for (const [status, message] of [
        [404, "City not found — check the spelling and try again."],
        [429, "Too many searches — please wait a minute and try again."],
        [500, "Server error — try again in a moment."],
    ]) {
        context.errorResponse = { status, json: async () => ({}) };
        assert.equal(await lexical(context, "readBackendError(errorResponse)"), message);
    }

    failNext = true;
    const failed = await lexical(context, 'loadCity("Nowhere")');
    assert.equal(failed, false);
    assert.equal(document.getElementById("errorMsg").textContent, "City not found — check the spelling and try again.");
    assert.equal(document.getElementById("errorMsg").classList.contains("hidden"), false);
    assert.equal(document.getElementById("loading").classList.contains("hidden"), true);
});
