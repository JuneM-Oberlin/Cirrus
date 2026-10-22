const assert = require("node:assert/strict");
const test = require("node:test");
const { documentStub, runClassicScript, lexical } = require("./helpers");

const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

// idle.js with a hand-run timer: elapse() fires the waiting timeout.
function loadIdle({ reduced = false, globeOpen = false } = {}) {
    const document = documentStub();
    let waiting = null;
    const globe = { drifting: false, isOpen: () => globeOpen, startDrift() { this.drifting = true; }, stopDrift() { this.drifting = false; } };
    const context = runClassicScript("public/idle.js", {
        CirrusConfig,
        document,
        window: { matchMedia: () => ({ matches: reduced }) },
        setTimeout: (callback, ms) => { waiting = { callback, ms }; return 1; },
        clearTimeout: () => { waiting = null; },
    });
    const idle = lexical(context, "CirrusIdle");
    idle.init({ globe, canPanWeather: () => true });
    const elapse = () => {
        const due = waiting;
        waiting = null;
        due.callback();
        return due.ms;
    };
    return { idle, document, globe, elapse, panel: document.getElementById("framePanel") };
}

test("after a quiet minute the weather pans, and any input stops it", () => {
    const { idle, document, elapse, panel } = loadIdle();
    assert.equal(elapse(), CirrusConfig.idle.afterMs, "it waits a full minute");
    assert.equal(panel.classList.contains("is-attract"), true);
    assert.equal(idle.isShowing(), "weather");

    document.dispatch("pointermove", {});
    assert.equal(panel.classList.contains("is-attract"), false, "input puts it back at once");
    assert.equal(idle.isShowing(), "");
});

test("an open globe turns by itself; reduced motion stays still", () => {
    const spinning = loadIdle({ globeOpen: true });
    spinning.elapse();
    assert.equal(spinning.globe.drifting, true);
    spinning.document.dispatch("keydown", {});
    assert.equal(spinning.globe.drifting, false);

    const calm = loadIdle({ reduced: true });
    calm.elapse();
    assert.equal(calm.panel.classList.contains("is-attract"), false);
    assert.equal(calm.idle.isShowing(), "");
});
