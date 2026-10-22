const assert = require("node:assert/strict");
const test = require("node:test");
const { element, documentStub, runClassicScript, lexical } = require("./helpers");

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

test("alerts encode coordinates, show the colored bar, open the alert screen, and step back", async () => {
    const document = documentStub();
    document.getElementById("alertDetail").classList.add("hidden");
    document.getElementById("alertBadge").hidden = true;
    const firstTile = { focused: 0 };
    document.getElementById("alertList").querySelector = () => ({ focus() { firstTile.focused += 1; } });

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
    let screen = null;
    const frame = {
        screenName: () => (screen ? screen.name : null),
        openScreen: (name, options) => { screen = { name, ...options }; },
        closeScreen: () => {
            const closing = screen;
            screen = null;
            if (closing && closing.onClose) {
                closing.onClose();
            }
        },
    };
    const context = runClassicScript("public/alerts.js", {
        document,
        fetch: async (url) => {
            urls.push(url);
            return { ok: true, json: async () => ({ alerts: [alert, { ...alert, id: "a2", event: "Flood Watch", tier: "watch", autoPop: false }] }) };
        },
    });
    const alerts = lexical(context, "CirrusAlerts");
    alerts.init({
        backendUrl: "https://cirrus-project1.duckdns.org",
        frame,
        show: (id) => document.getElementById(id).classList.remove("hidden"),
        hide: (id) => document.getElementById(id).classList.add("hidden"),
        set: (id, value) => { document.getElementById(id).textContent = value; },
        getTimezoneOffset: () => 0,
        formatCityTime: () => "10:00 p.m.",
        allowAutoPop: () => true,
    });

    await alerts.checkAlerts({ lat: "1&admin=true", lon: "2 3" });
    assert.equal(urls[0], "https://cirrus-project1.duckdns.org/alerts?lat=1%26admin%3Dtrue&lon=2%203");
    assert.equal(alerts.getStormLightningRank(), "severe");

    // a severe alert opened the screen by itself, with a red header
    assert.equal(screen.name, "alert");
    assert.equal(screen.title, "Weather Alert");
    assert.equal(document.getElementById("frameHeader").classList.contains("frame-header--warning"), true);
    assert.equal(document.getElementById("alertListHeading").textContent, "2 active alerts");
    assert.equal(document.getElementById("alertBadge").hidden, false);
    assert.equal(document.getElementById("alertBadge").className, "home-badge home-badge--warning");

    const tiles = document.getElementById("alertList").children.map((item) => item.children[0]);
    assert.equal(tiles.length, 2);
    tiles[0].dispatch("click");
    assert.equal(document.getElementById("alertDetail").classList.contains("hidden"), false);
    assert.equal(document.getElementById("alertDetail").children[0].textContent, "Tornado Warning");
    assert.equal(document.getElementById("alertListWrap").classList.contains("hidden"), true);

    // Back from the detail returns to the list instead of closing
    assert.equal(screen.onBack(), true);
    assert.equal(document.getElementById("alertDetail").classList.contains("hidden"), true);
    assert.equal(screen.onBack(), false);

    // closing dismisses auto-open for this search and brings back the bar
    frame.closeScreen();
    assert.equal(document.getElementById("frameHeader").classList.contains("frame-header--warning"), false);
    const bar = document.getElementById("frameAlertSlot").children[0];
    assert.equal(bar.className, "alert-bar alert-bar--warning");
    assert.equal(bar.children[1].textContent, "Tornado Warning · until 10:00 p.m.");
    assert.equal(bar.children[2].textContent, "+1 more");
    alerts.sync();
    assert.equal(screen, null, "a dismissed alert does not reopen by itself");

    bar.dispatch("click");
    assert.equal(screen.name, "alert");

    alerts.resetForSearch();
    assert.equal(screen, null);
    assert.equal(document.getElementById("frameAlertSlot").children.length, 0);
    assert.equal(document.getElementById("alertBadge").hidden, true);
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
