/* The pointer. With a mouse, Cirrus draws its own hand (cursors/hand.svg)
   that leans a little in the direction it moves, gives a tiny bounce when
   it lands on something you can click, and pokes down while you press.
   Text fields keep the normal text cursor. On touch screens a soft ripple
   spreads where your finger lands instead. Reduced motion and high
   contrast mode keep the plain, still hand cursor from base.css. */

const CirrusPointer = (function () {
    const CLICKABLE = "button:not(:disabled), a[href], label[for], [role='button'], [role='radio']";
    const TYPING = "input, textarea, select";

    let hand = null;   // the moving element (position and lean)
    let finger = null; // the picture inside it (bounce and poke)
    const state = {
        x: 0,
        y: 0,
        lastMoveAt: 0,
        lean: 0,
        leanTarget: 0,
        frame: null,
        over: null,
    };

    function settings() {
        return CirrusConfig.pointer;
    }

    function matches(query) {
        return window.matchMedia(query).matches;
    }

    function reducedMotion() {
        return matches("(prefers-reduced-motion: reduce)");
    }

    function wantsDrawnHand() {
        return matches("(hover: hover) and (pointer: fine)")
            && !reducedMotion()
            && !matches("(forced-colors: active)");
    }

    function cssValue(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function closestFrom(target, selector) {
        if (!target || !target.closest) {
            return null;
        }
        return target.closest(selector);
    }

    /* ---------- The drawn hand ---------- */

    function buildHand() {
        hand = document.createElement("div");
        hand.className = "soft-cursor is-hidden";
        hand.setAttribute("aria-hidden", "true");
        finger = document.createElement("img");
        finger.className = "soft-cursor-hand";
        finger.src = "cursors/hand.svg";
        finger.alt = "";
        hand.appendChild(finger);
        document.body.appendChild(hand);
        document.documentElement.classList.add("has-soft-cursor");
    }

    // One frame: move to the pointer and ease the lean toward its target.
    // Frames keep coming only while the hand is still leaning.
    function draw() {
        state.frame = null;
        state.lean += (state.leanTarget - state.lean) * settings().leanFollow;
        state.leanTarget *= settings().leanSettle;
        hand.style.transform = "translate(" + state.x + "px, " + state.y + "px) rotate(" + state.lean.toFixed(2) + "deg)";
        if (Math.abs(state.lean) > 0.05 || Math.abs(state.leanTarget) > 0.05) {
            state.frame = requestAnimationFrame(draw);
        }
    }

    function requestDraw() {
        if (!state.frame) {
            state.frame = requestAnimationFrame(draw);
        }
    }

    // A tiny hop when the hand lands on a button or link.
    function bounce() {
        finger.animate([
            { transform: "scale(1)", easing: "ease-out" },
            { transform: "scale(" + settings().bounceScale + ")", offset: 0.3, easing: cssValue("--spring-pop") },
            { transform: "scale(1)" },
        ], { duration: settings().bounceMs });
    }

    function onMove(event) {
        if (event.pointerType !== "mouse") {
            hand.classList.add("is-hidden");
            return;
        }
        const elapsed = Math.max(1, event.timeStamp - state.lastMoveAt);
        const speedX = (event.clientX - state.x) / elapsed;
        state.lastMoveAt = event.timeStamp;
        state.x = event.clientX;
        state.y = event.clientY;
        const maxLean = settings().maxLeanDeg;
        state.leanTarget = Math.max(-maxLean, Math.min(maxLean, speedX * settings().leanPerSpeed));

        // over a text field the normal text cursor takes over
        hand.classList.toggle("is-hidden", Boolean(closestFrom(event.target, TYPING)));

        const clickable = closestFrom(event.target, CLICKABLE);
        if (clickable !== state.over) {
            state.over = clickable;
            if (clickable) {
                bounce();
            }
        }
        requestDraw();
    }

    function wireHand() {
        buildHand();
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse") {
                hand.classList.add("is-pressing");
            }
        });
        document.addEventListener("pointerup", () => hand.classList.remove("is-pressing"));
        // leaving the window hides the hand until the mouse comes back
        document.documentElement.addEventListener("mouseleave", () => hand.classList.add("is-hidden"));
    }

    /* ---------- Touch ripple ---------- */

    function ripple(event) {
        if (event.pointerType !== "touch") {
            return;
        }
        const ring = document.createElement("span");
        ring.className = "tap-ripple";
        ring.setAttribute("aria-hidden", "true");
        document.body.appendChild(ring);
        const at = "translate(" + event.clientX + "px, " + event.clientY + "px)";
        const tap = settings().ripple;
        let keyframes = [
            { transform: at + " scale(" + tap.fromScale + ")", opacity: tap.startOpacity },
            { transform: at + " scale(1)", opacity: 0 },
        ];
        let timing = { duration: tap.durationMs, easing: "ease-out" };
        // reduced motion: the ring just fades where it is
        if (reducedMotion()) {
            keyframes = [
                { transform: at, opacity: tap.startOpacity },
                { transform: at, opacity: 0 },
            ];
            timing = { duration: tap.fadeMs, easing: "linear" };
        }
        const animation = ring.animate(keyframes, timing);
        animation.onfinish = () => ring.remove();
    }

    function init() {
        if (wantsDrawnHand()) {
            wireHand();
        }
        document.addEventListener("pointerdown", ripple);
    }

    return { init };
})();
