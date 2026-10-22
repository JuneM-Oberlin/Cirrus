/* Idle charm. After a minute with no input, Cirrus shows off a little,
   like a console's attract screen: the globe turns slowly on its own, or
   the satellite picture behind the weather drifts and pans. Any input
   (a mouse move, a tap, a key) puts everything back at once. Nothing
   happens with reduced motion, or while the tab is hidden. */

const CirrusIdle = (function () {
    const INPUTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"];

    let deps = {
        globe: null,
        // true when a weather view is on screen with nothing covering it
        canPanWeather: () => false,
    };
    let timer = null;
    let showing = "";   // "", "globe", or "weather"

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function start() {
        if (reducedMotion() || document.visibilityState === "hidden") {
            return;
        }
        if (deps.globe && deps.globe.isOpen()) {
            showing = "globe";
            deps.globe.startDrift();
        } else if (deps.canPanWeather()) {
            showing = "weather";
            document.getElementById("framePanel").classList.add("is-attract");
        }
    }

    function stop() {
        if (showing === "globe") {
            deps.globe.stopDrift();
        } else if (showing === "weather") {
            document.getElementById("framePanel").classList.remove("is-attract");
        }
        showing = "";
    }

    // Any input: back to normal, and the minute starts over.
    function wake() {
        stop();
        clearTimeout(timer);
        timer = setTimeout(start, CirrusConfig.idle.afterMs);
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        INPUTS.forEach((type) => {
            document.addEventListener(type, wake, { capture: true, passive: true });
        });
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                stop();
                clearTimeout(timer);
            } else {
                wake();
            }
        });
        wake();
    }

    function isShowing() {
        return showing;
    }

    return { init, wake, isShowing };
})();
