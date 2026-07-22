const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("the protected mobile interface and responsive stylesheet stay unchanged", () => {
    const html = read("public/index.html");
    const start = html.indexOf('    <div class="page-content">');
    const closingMarker = "    </div> <!-- /page-content -->";
    const end = html.indexOf(closingMarker) + closingMarker.length;

    assert.notEqual(start, -1, "mobile page-content block is present");
    assert.notEqual(end, closingMarker.length - 1, "mobile page-content closing marker is present");
    assert.equal(
        sha256(html.slice(start, end)),
        "331ebd3ce80e2dd118414c2ae4ab40915e288d2ca4f9ddfcf940df5b72788fdc"
    );
    assert.equal(
        sha256(read("public/responsive.css")),
        "5cc60ff404604b7386eaf15a4743fb2a71158533c8737f5520463e214898fd54"
    );
});

test("Variant C ships a separate desktop shell with twelve channels", () => {
    const html = read("public/index.html");

    assert.match(html, /id="desktopChannels"/);
    assert.match(html, /id="desktopCityInput"/);
    assert.equal((html.match(/data-channel-target=/g) || []).length, 6);
    assert.equal((html.match(/class="channel-tile channel-tile--empty"/g) || []).length, 6);
    assert.match(html, /<script src="channels\.js\?/);
});

test("desktop controller exposes the handoff API", () => {
    const source = read("public/channels.js");

    for (const method of ["init", "render", "setGlobeImage", "setSearching"]) {
        assert.match(source, new RegExp(`${method}\\s*:`), `missing ${method} API`);
    }
    assert.match(source, /const DESKTOP_QUERY = "\(min-width: 768px\)"/);
    assert.match(source, /if \(!isDesktop\(\)\) \{\s*return;\s*\}/);
});

test("shared forecast loading keeps the desktop data contract explicit", () => {
    const source = read("public/script.js");

    assert.match(source, /tempMin: data\.tempMin/);
    assert.match(source, /tempMax: data\.tempMax/);
    assert.match(source, /showToday = false/);
    assert.match(source, /renderChannels = false/);
    assert.match(source, /forecastData\.length < 5/);
    assert.match(source, /Forecast data is incomplete\./);
    assert.match(source, /CirrusDesktopChannels\.render\(weatherData, forecastData\)/);
});

test("Variant C styling is desktop-scoped and reduced-motion safe", () => {
    const styles = read("public/style.css");
    const animations = read("public/animations.css");

    assert.match(styles, /\.desktop-channels\s*\{\s*display: none;/);
    assert.match(styles, /@media \(min-width: 768px\)/);
    assert.match(animations, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(animations, /\.channel-grid--enter \.channel-tile/);
    assert.match(animations, /\.channel-takeover:not\(\.hidden\)/);
});
