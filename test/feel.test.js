const assert = require("node:assert/strict");
const test = require("node:test");
const { element, documentStub, runClassicScript, lexical } = require("./helpers");

// A button stub that finds itself (or nothing) with closest().
function pressable(document, classes = []) {
    const button = element(document, "button");
    classes.forEach((name) => button.classList.add(name));
    button.closest = (selector) => {
        const wanted = selector.split(",").map((part) => part.trim());
        const matches = wanted.some((part) => part === "button"
            || (part.startsWith(".") && button.classList.contains(part.slice(1))));
        if (matches) {
            return button;
        }
        return null;
    };
    return button;
}

function loadFeel({ reduced = false } = {}) {
    const document = documentStub();
    const context = runClassicScript("public/feel.js", {
        document,
        window: { matchMedia: () => ({ matches: reduced }) },
    });
    const feel = lexical(context, "CirrusFeel");
    feel.init();
    return { document, feel };
}

test("a press plays the whole squash and a hover adds one shine layer", () => {
    const { document } = loadFeel();
    const button = pressable(document, ["chip-btn"]);

    document.dispatch("pointerdown", { target: button });
    assert.equal(button.classList.contains("is-squashing"), true, "pressing starts the squash");

    // the squash ends on its own schedule, not when the pointer lifts
    document.dispatch("pointerup", { target: button });
    assert.equal(button.classList.contains("is-squashing"), true);
    document.dispatch("animationend", { target: button, animationName: "wiiSquashPress" });
    assert.equal(button.classList.contains("is-squashing"), false);

    document.dispatch("pointerover", { target: button });
    document.dispatch("pointerover", { target: button });
    const shines = button.children.filter((child) => child.classList.contains("shine"));
    assert.equal(shines.length, 1, "the shine layer is added once");
    assert.equal(shines[0].getAttribute("aria-hidden"), "true");

    // Enter on a focused button squashes it too
    button.classList.remove("is-squashing");
    document.dispatch("keydown", { target: button, key: "Enter", repeat: false });
    assert.equal(button.classList.contains("is-squashing"), true);
});

test("disabled buttons and reduced motion skip the squash", () => {
    const { document } = loadFeel();
    const disabled = pressable(document);
    disabled.disabled = true;
    document.dispatch("pointerdown", { target: disabled });
    assert.equal(disabled.classList.contains("is-squashing"), false);

    const calm = loadFeel({ reduced: true });
    const button = pressable(calm.document);
    calm.document.dispatch("pointerdown", { target: button });
    assert.equal(button.classList.contains("is-squashing"), false);
});

test("buttons tick on hover, pop on press, and buzz under a finger", () => {
    const document = documentStub();
    const context = runClassicScript("public/feel.js", {
        document,
        window: { matchMedia: () => ({ matches: false }) },
    });
    const played = [];
    const buzzes = [];
    lexical(context, "CirrusFeel").init({
        sound: { play: (name) => played.push(name), hover: () => played.push("tick") },
        vibrate: (ms) => buzzes.push(ms),
        hapticMs: 8,
    });
    const button = pressable(document, ["frame-btn"]);
    const label = element(document, "label");
    label.closest = button.closest;

    // moving across the button and its label ticks once
    document.dispatch("pointerover", { target: button, pointerType: "mouse" });
    document.dispatch("pointerover", { target: label, pointerType: "mouse" });
    assert.deepEqual(played, ["tick"]);

    document.dispatch("pointerdown", { target: button, pointerType: "touch" });
    assert.deepEqual(played, ["tick", "pop"]);
    assert.deepEqual(buzzes, [8], "a finger press buzzes");
    document.dispatch("pointerdown", { target: button, pointerType: "mouse" });
    assert.deepEqual(buzzes, [8], "a mouse press doesn't");

    // Back leaves its sound to the frame (a lower blip, not a pop)
    const back = pressable(document);
    back.dataset.sound = "back";
    document.dispatch("pointerdown", { target: back, pointerType: "mouse" });
    assert.deepEqual(played, ["tick", "pop", "pop"]);
});

test("a not-found town shakes the field once", () => {
    const { document, feel } = loadFeel();
    const field = element(document, "field");
    feel.shake(field);
    assert.equal(field.classList.contains("is-shaking"), true);
    document.dispatch("animationend", { target: field, animationName: "nopeShake" });
    assert.equal(field.classList.contains("is-shaking"), false);

    const calm = loadFeel({ reduced: true });
    const still = element(calm.document, "still");
    calm.feel.shake(still);
    assert.equal(still.classList.contains("is-shaking"), false, "reduced motion doesn't shake");
});
