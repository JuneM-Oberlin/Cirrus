const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the page ships one frame shared by phones and desktops", () => {
    const html = read("public/index.html");

    for (const id of ["frame", "navUp", "navDown", "backButton", "settingsButton", "globeButton",
        "frameTitle", "locationPill", "cityInput", "panelViewport", "panelAsOf", "frameClock"]) {
        assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
    }
    assert.match(html, /data-view="current"/);
});

test("desktop Home keeps the twelve-channel menu without the old takeover", () => {
    const html = read("public/index.html");

    assert.match(html, /id="desktopChannels"/);
    assert.match(html, /id="desktopCityInput"/);
    assert.equal((html.match(/data-channel-target=/g) || []).length, 6);
    assert.equal((html.match(/class="channel-tile channel-tile--empty"/g) || []).length, 6);
    assert.doesNotMatch(html, /channelTakeover/);
});

test("scripts load in dependency order", () => {
    const html = read("public/index.html");
    const order = ["iconMap.js", "units.js", "alerts.js", "atmosphere.js", "frame.js", "views.js",
        "search.js", "channels.js", "script.js"];
    let last = -1;
    order.forEach((file) => {
        const index = html.indexOf(`<script src="${file}?`);
        assert.ok(index > last, `${file} loads after the files it depends on`);
        last = index;
    });
});

test("theme.css loads first so every stylesheet can use its tokens", () => {
    const html = read("public/index.html");
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="([a-z-]+)\.css/g)].map((m) => m[1]);
    assert.equal(sheets[0], "theme");
    assert.match(read("public/theme.css"), /--font-ui:/);
});

test("motion respects prefers-reduced-motion", () => {
    const motion = read("public/motion.css");
    assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(motion, /\.panel-track \{\s*transition: none !important;/);
});
