const assert = require("node:assert/strict");
const test = require("node:test");
const { documentStub, storageStub, runClassicScript, lexical } = require("./helpers");

const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

// A stand-in for the Web Audio API that just counts the tones it is asked for.
function fakeAudio() {
    const made = [];
    const param = (value = 0) => ({
        value,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
    });
    const node = (extra) => Object.assign({ connect() {}, disconnect() {} }, extra);
    class FakeContext {
        constructor() {
            this.currentTime = 0;
            this.state = "running";
            this.destination = {};
            this.tones = 0;
            made.push(this);
        }
        createGain() { return node({ gain: param(1) }); }
        createOscillator() {
            this.tones += 1;
            return node({ frequency: param(), detune: param(), start() {}, stop() {} });
        }
        createBiquadFilter() { return node({ frequency: param() }); }
        createDelay() { return node({ delayTime: param() }); }
        resume() {}
    }
    return { FakeContext, made };
}

function loadSound(localStorage = storageStub()) {
    const document = documentStub();
    const audio = fakeAudio();
    const timers = { intervals: 0, cleared: 0 };
    const context = runClassicScript("public/sound.js", {
        CirrusConfig,
        console: { log() {} },
        document,
        localStorage,
        window: { AudioContext: audio.FakeContext },
        setInterval: () => { timers.intervals += 1; return timers.intervals; },
        clearInterval: () => { timers.cleared += 1; },
        setTimeout: () => 0,
    });
    const sound = lexical(context, "CirrusSound");
    sound.init();
    const tones = () => audio.made.reduce((sum, ctx) => sum + ctx.tones, 0);
    return { sound, document, tones, timers, localStorage };
}

test("no sound before the first interaction, then effects play", () => {
    const { sound, document, tones } = loadSound();
    sound.play("pop");
    assert.equal(tones(), 0, "nothing plays (or is even set up) before a click or key");

    document.dispatch("pointerdown", {});
    sound.play("pop");
    assert.equal(tones(), CirrusConfig.sound.pop.length);
    sound.play("chime");
    assert.equal(tones(), CirrusConfig.sound.pop.length + CirrusConfig.sound.chime.length);
});

test("muting is remembered, and turning effects back on pops", () => {
    const localStorage = storageStub();
    const first = loadSound(localStorage);
    first.document.dispatch("keydown", {});
    first.sound.update({ effects: "off" });
    first.sound.play("pop");
    assert.equal(first.tones(), 0, "muted");
    assert.deepEqual(JSON.parse(localStorage.getItem("cirrus_sound")), { effects: "off", music: "off" });

    // the next visit starts muted
    const second = loadSound(localStorage);
    assert.equal(second.sound.getSettings().effects, "off");
    second.document.dispatch("pointerdown", {});
    second.sound.update({ effects: "on" });
    assert.equal(second.tones(), CirrusConfig.sound.pop.length, "a confirmation pop");
});

test("hover ticks are spaced out, and music starts and stops", () => {
    const { sound, document, tones, timers } = loadSound();
    document.dispatch("pointerdown", {});
    sound.hover();
    sound.hover();
    assert.equal(tones(), CirrusConfig.sound.tick.length, "a second tick right away is skipped");

    const before = tones();
    sound.update({ music: "on" });
    assert.ok(tones() > before, "music queues its first chord");
    assert.equal(timers.intervals, 1, "and keeps scheduling");
    sound.update({ music: "off" });
    assert.equal(timers.cleared, 1, "turning music off stops the schedule");
});

test("a warning that arrives before the first click sounds right after it", () => {
    const { sound, document, tones } = loadSound();
    sound.play("alert");
    assert.equal(tones(), 0);
    document.dispatch("pointerdown", {});
    assert.equal(tones(), CirrusConfig.sound.alert.length);
});
