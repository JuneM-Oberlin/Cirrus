const assert = require("node:assert/strict");
const test = require("node:test");
const { documentStub, element, runClassicScript, lexical } = require("./helpers");

const CirrusConfig = lexical(runClassicScript("public/feel-config.js"), "CirrusConfig");

function loadPointer({ finePointer = true, reduced = false } = {}) {
    const document = documentStub();
    document.documentElement = element(document, "html");
    const added = [];
    document.body.appendChild = (child) => {
        added.push(child);
        return child;
    };
    const matchMedia = (query) => {
        let matches = false;
        if (query.includes("pointer: fine")) {
            matches = finePointer;
        } else if (query.includes("reduced-motion")) {
            matches = reduced;
        }
        return { matches };
    };
    const context = runClassicScript("public/pointer.js", {
        CirrusConfig,
        document,
        window: { matchMedia },
        getComputedStyle: () => ({ getPropertyValue: () => "ease" }),
        requestAnimationFrame: () => 1,
    });
    lexical(context, "CirrusPointer").init();
    return { document, added };
}

test("a mouse gets the drawn hand; reduced motion keeps the plain cursor", () => {
    const mouse = loadPointer();
    assert.equal(mouse.document.documentElement.classList.contains("has-soft-cursor"), true);
    assert.equal(mouse.added[0].className, "soft-cursor is-hidden", "hidden until the mouse moves");

    const calm = loadPointer({ reduced: true });
    assert.equal(calm.document.documentElement.classList.contains("has-soft-cursor"), false);
    assert.equal(calm.added.length, 0);

    const touch = loadPointer({ finePointer: false });
    assert.equal(touch.added.length, 0, "touch screens never get the drawn hand");
});

test("a finger tap leaves a ripple that cleans itself up", () => {
    const { document, added } = loadPointer({ finePointer: false });
    document.dispatch("pointerdown", { pointerType: "touch", clientX: 40, clientY: 80 });
    assert.equal(added.length, 1);
    const ring = added[0];
    assert.equal(ring.className, "tap-ripple");
    assert.equal(ring.getAttribute("aria-hidden"), "true");

    // a mouse click makes no ripple
    document.dispatch("pointerdown", { pointerType: "mouse", clientX: 40, clientY: 80 });
    assert.equal(added.length, 1);
});
