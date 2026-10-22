const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root, runClassicScript, lexical } = require("./helpers");

test("extra globe cities are complete, unique, and separate from the major cities", () => {
    const cities = lexical(runClassicScript("public/globe-cities.js"), "CirrusGlobeCities");
    const javaList = fs.readFileSync(path.join(root, "src/main/java/com/weatherapp/service/GlobeCities.java"), "utf8");
    const majors = new Set([...javaList.matchAll(/add\(regions, "[^"]+", "([^"]+)"/g)].map((match) => match[1]));
    assert.equal(majors.size, 42);

    assert.ok(cities.length > 100, "a good number of extra cities");
    const queries = new Set();
    cities.forEach((city) => {
        assert.ok(city.name && city.query, "every city has a label and a search query");
        assert.ok(city.query.includes(","), city.name + " searches with a state or country code");
        assert.ok([2, 3].includes(city.tier), city.name + " is tier 2 or 3");
        assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180, city.name + " has real coordinates");
        assert.ok(!majors.has(city.name), city.name + " is already a major city");
        assert.ok(!queries.has(city.query), city.query + " is listed twice");
        queries.add(city.query);
    });
    assert.ok(cities.some((city) => city.tier === 2) && cities.some((city) => city.tier === 3));
});
