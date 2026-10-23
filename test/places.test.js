const assert = require("node:assert/strict");
const test = require("node:test");
const { documentStub, runClassicScript, lexical } = require("./helpers");

const places = lexical(runClassicScript("public/places.js"), "CirrusPlaces");
const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

test("typing a US state finds the right town", () => {
    assert.equal(places.tidy("Canton OH"), "Canton,OH,US");
    assert.equal(places.tidy("Canton, Ohio"), "Canton,OH,US");
    assert.equal(places.tidy("augusta ga"), "augusta,GA,US");
    assert.equal(places.tidy("Augusta, Georgia"), "Augusta,GA,US");
    assert.equal(places.tidy("Salt Lake City Utah"), "Salt Lake City,UT,US");
    assert.equal(places.tidy("Springfield, IL, USA"), "Springfield,IL,US");
    assert.equal(places.tidy("Washington D.C."), "Washington,DC,US");
    assert.equal(places.tidy("Canton,OH,US"), "Canton,OH,US");

    // anything else is left as typed
    assert.equal(places.tidy("  Canton  "), "Canton");
    assert.equal(places.tidy("New York"), "New York");
    assert.equal(places.tidy("Kansas City"), "Kansas City");
    assert.equal(places.tidy("London, UK"), "London, UK");
    // a state on its own, or a state name that is part of the town's name
    assert.equal(places.tidy("Georgia"), "Georgia");
    assert.equal(places.tidy("West Virginia"), "West Virginia");
    assert.equal(places.tidy("Port Washington"), "Port Washington");
    assert.equal(places.tidy("Fort Washington"), "Fort Washington");
});

test("queries carry either a name or a picked place's exact position", () => {
    const canton = { name: "Canton", state: "Ohio", country: "US", lat: 40.799, lon: -81.3784 };
    const query = places.fromPlace(canton);
    assert.equal(query, "Canton, Ohio@40.7990,-81.3784");
    assert.equal(places.isPicked(query), true);
    assert.equal(JSON.stringify(places.parse(query)), JSON.stringify({ label: "Canton, Ohio", lat: 40.799, lon: -81.3784 }));
    assert.equal(places.shortName(query), "Canton");
    assert.equal(places.requestParams(query), "lat=40.799&lon=-81.3784");

    assert.equal(places.isPicked("Denver"), false);
    assert.equal(places.requestParams("São Paulo"), "city=S%C3%A3o%20Paulo");
    assert.equal(places.labelOf("Canton,OH,US"), "Canton, OH");
    assert.equal(places.labelOf("Denver"), "Denver");
});

test("matches read as town and state in the US, town and country elsewhere", () => {
    const matches = [
        { name: "Canton", state: "Texas", country: "US", lat: 32.5, lon: -95.8 },
        { name: "Guangzhou", state: "Guangdong Province", country: "CN", lat: 23.1, lon: 113.3 },
        { name: "Augusta", state: "Sicily", country: "IT", lat: 37.2, lon: 15.2 },
        { name: "Cordoba", state: "Córdoba", country: "AR", lat: -31.4, lon: -64.2 },
        { name: "Cordoba", state: "Veracruz", country: "AR", lat: -19.0, lon: -97.0 },
    ];
    assert.equal(places.describe(matches[0], matches), "Canton, Texas");
    assert.match(places.describe(matches[1], matches), /^Guangzhou, (China|CN)$/);
    assert.match(places.describe(matches[2], matches), /^Augusta, (Italy|IT)$/);
    // two of the same name in one country get their province added
    assert.match(places.describe(matches[3], matches), /^Cordoba, Córdoba, (Argentina|AR)$/);
});

test("search goes straight to a place when it is clear, and lists matches when it isn't", async () => {
    function loadSearch(findPlaces) {
        const search = lexical(runClassicScript("public/search.js", {
            document: documentStub(),
            window: { matchMedia: () => ({ matches: false }) },
            CirrusPlaces: places,
            CirrusConfig,
        }), "CirrusSearch");
        search.init({ frame: { screenName: () => "search" }, onSearch() {}, getRecents: () => [], findPlaces });
        return search;
    }
    const asked = [];
    const cantons = [
        { name: "Canton", state: "Texas", country: "US", lat: 32.5567, lon: -95.8633 },
        { name: "Canton", state: "Ohio", country: "US", lat: 40.799, lon: -81.3784 },
    ];
    const search = loadSearch(async (text) => {
        asked.push(text);
        if (text === "Canton") {
            return cantons;
        }
        if (text === "Oberlin") {
            return [{ name: "Oberlin", state: "Ohio", country: "US", lat: 41.2939, lon: -82.2174 }];
        }
        return [];
    });

    // results come from the script's own sandbox, so compare them as JSON
    const resolve = async (s, text) => JSON.stringify(await s.resolve(text));
    assert.equal(await resolve(search, "Canton"), JSON.stringify({ places: cantons }));
    assert.equal(await resolve(search, "Oberlin"), JSON.stringify({ query: "Oberlin, Ohio@41.2939,-82.2174" }));
    assert.equal(await resolve(search, "Atlantis"), JSON.stringify({ query: "Atlantis" }));
    // a typed state never needs the list
    assert.equal(await resolve(search, "Canton OH"), JSON.stringify({ query: "Canton,OH,US" }));
    assert.equal(await resolve(search, "Paris, France"), JSON.stringify({ query: "Paris, France" }));
    assert.deepEqual(asked, ["Canton", "Oberlin", "Atlantis"]);

    // an older server without place search: search as typed
    const offline = loadSearch(async () => null);
    assert.equal(await resolve(offline, "Canton"), JSON.stringify({ query: "Canton" }));
});
