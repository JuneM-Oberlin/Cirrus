const assert = require("node:assert/strict");
const test = require("node:test");
const { documentStub, element, runClassicScript, lexical } = require("./helpers");

const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

function loadEggs() {
    const document = documentStub();
    const played = [];
    const timers = [];
    const context = runClassicScript("public/eggs.js", {
        CirrusConfig,
        document,
        window: { matchMedia: () => ({ matches: false }) },
        getComputedStyle: () => ({ getPropertyValue: () => "ease" }),
        setTimeout: (callback) => timers.push(callback),
    });
    const eggs = lexical(context, "CirrusEggs");
    eggs.init({ sound: { play: (name) => played.push(name) } });

    // a big sun: the wrapper and its picture
    const wrapper = element(document, "wrapper");
    const sun = element(document, "sun");
    wrapper.appendChild(sun);
    sun.closest = () => sun;
    wrapper.querySelector = () => sun;
    return { document, eggs, played, timers, wrapper, sun };
}

test("five quick taps make the sun wink, with a sparkle", () => {
    const { document, played, timers, wrapper, sun } = loadEggs();
    for (let i = 0; i < CirrusConfig.eggs.sunTaps - 1; i += 1) {
        document.dispatch("pointerdown", { target: sun });
    }
    assert.equal(wrapper.classList.contains("is-winking"), false, "not yet");
    document.dispatch("pointerdown", { target: sun });
    assert.equal(wrapper.classList.contains("is-winking"), true);
    assert.deepEqual(played, ["sparkle"]);
    assert.equal(wrapper.children.some((child) => child.getAttribute("class") === "sun-face"), true);

    // the face goes away again
    timers.forEach((callback) => callback());
    assert.equal(wrapper.classList.contains("is-winking"), false);
    assert.equal(wrapper.children.some((child) => child.getAttribute("class") === "sun-face"), false);
});

test("snow puts caps on the frame; other weather takes them off", () => {
    const { document, eggs } = loadEggs();
    eggs.setWeather(601);
    assert.equal(document.body.classList.contains("is-snowing"), true);
    eggs.setWeather(800);
    assert.equal(document.body.classList.contains("is-snowing"), false);
});
