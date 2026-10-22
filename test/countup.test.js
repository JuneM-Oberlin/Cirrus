const assert = require("node:assert/strict");
const test = require("node:test");
const { element, documentStub, runClassicScript, lexical } = require("./helpers");

const CirrusConfig = lexical(runClassicScript("public/config.js"), "CirrusConfig");

// Runs countup.js with a hand-cranked clock: tick(ms) advances time and
// runs the frames that were waiting.
function loadCountUp({ reduced = false } = {}) {
    let now = 0;
    let frames = [];
    const context = runClassicScript("public/countup.js", {
        CirrusConfig,
        window: { matchMedia: () => ({ matches: reduced }) },
        performance: { now: () => now },
        requestAnimationFrame: (callback) => frames.push(callback),
    });
    const tick = (ms) => {
        now += ms;
        const waiting = frames;
        frames = [];
        waiting.forEach((callback) => callback(now));
    };
    return { countUp: lexical(context, "CirrusCountUp"), tick };
}

function viewWith(numbers) {
    const document = documentStub();
    const view = element(document, "view");
    view.querySelectorAll = () => numbers;
    return view;
}

test("big numbers roll up from zero and land on the real text", () => {
    const { countUp, tick } = loadCountUp();
    const document = documentStub();
    const temp = element(document, "temp");
    temp.textContent = "69°";
    const cold = element(document, "cold");
    cold.textContent = "-4°C";
    const empty = element(document, "empty");
    empty.textContent = "--";

    countUp.playIn(viewWith([temp, cold, empty]));
    assert.equal(temp.textContent, "0°", "starts from zero, keeping the degree sign");
    assert.equal(cold.textContent, "0°C");
    assert.equal(empty.textContent, "--", "non-numbers are left alone");

    tick(300);
    const halfway = parseInt(temp.textContent, 10);
    assert.ok(halfway > 0 && halfway < 69, "mid-roll value " + halfway);
    assert.ok(parseInt(cold.textContent, 10) < 0, "negative temperatures roll downward");

    tick(CirrusConfig.countUp.durationMs);
    assert.equal(temp.textContent, "69°");
    assert.equal(cold.textContent, "-4°C");
});

test("a re-render mid-roll wins, and reduced motion skips the roll", () => {
    const { countUp, tick } = loadCountUp();
    const document = documentStub();
    const temp = element(document, "temp");
    temp.textContent = "69°";
    countUp.playIn(viewWith([temp]));
    tick(100);
    temp.textContent = "21°C";
    tick(100);
    tick(CirrusConfig.countUp.durationMs);
    assert.equal(temp.textContent, "21°C");

    const calm = loadCountUp({ reduced: true });
    const still = element(document, "still");
    still.textContent = "69°";
    calm.countUp.playIn(viewWith([still]));
    assert.equal(still.textContent, "69°");
});
