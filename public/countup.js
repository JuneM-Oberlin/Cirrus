/* Big numbers roll up from zero when a view opens, like a scoreboard.
   Only the number moves; the degree sign and units stay put. The real
   value is written back at the end, and reduced motion skips it. */

const CirrusCountUp = (function () {
    const NUMBERS = ".hero-temp, .hero-low, .fiveday-high, .fiveday-low, .sixhour-high, .sixhour-low, .uv-value";
    // element -> its real text, for numbers that are still rolling
    const finals = new Map();

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function roll(element, durationMs) {
        let finalText = element.textContent;
        if (finals.has(element)) {
            finalText = finals.get(element);
        }
        const match = /^(-?\d+)(.*)$/s.exec(finalText);
        if (!match) {
            return;
        }
        const target = parseInt(match[1], 10);
        const suffix = match[2];
        if (target === 0) {
            return;
        }
        finals.set(element, finalText);
        element.textContent = "0" + suffix;
        let written = element.textContent;
        const began = performance.now();

        const step = (now) => {
            // If the view re-rendered meanwhile (new units, new city), the
            // fresh text wins and this roll stops.
            if (element.textContent !== written) {
                finals.delete(element);
                return;
            }
            const t = Math.min(1, (now - began) / durationMs);
            if (t >= 1) {
                element.textContent = finalText;
                finals.delete(element);
                return;
            }
            element.textContent = Math.round(target * easeOut(t)) + suffix;
            written = element.textContent;
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // Rolls every big number inside a view or screen.
    function playIn(container) {
        if (!container || reducedMotion()) {
            return;
        }
        container.querySelectorAll(NUMBERS).forEach((element) => {
            roll(element, CirrusConfig.countUp.durationMs);
        });
    }

    return { playIn };
})();
