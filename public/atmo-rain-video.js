/* Rain atmosphere — looping video overlay over the globe */

const AtmoRainVideo = (function () {
    const OPACITY = {
        drizzle: 0.06,
        rain: 0.09,
        "rain-heavy": 0.13,
        sleet: 0.08,
    };

    const MOBILE_BOOST = 1.35;

    let video = null;
    let activeProfile = null;
    let gestureHooked = false;

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function isMobileViewport() {
        return window.matchMedia("(max-width: 768px)").matches;
    }

    function getVideo() {
        if (!video) {
            video = document.getElementById("atmoRainVideo");
        }
        return video;
    }

    function opacityFor(profileName) {
        const base = OPACITY[profileName] ?? OPACITY.rain;
        return isMobileViewport() ? base * MOBILE_BOOST : base;
    }

    function tryPlay(el) {
        if (!el || el.classList.contains("is-hidden") || prefersReducedMotion()) {
            return;
        }
        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    function hookGestureResume(el) {
        if (gestureHooked) {
            return;
        }
        gestureHooked = true;

        const resume = () => {
            if (activeProfile) {
                tryPlay(el);
            }
        };

        document.addEventListener("touchstart", resume, { passive: true });
        document.addEventListener("click", resume);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                resume();
            }
        });
    }

    function start(profileName) {
        const el = getVideo();
        if (!el) {
            return;
        }

        activeProfile = profileName;
        el.classList.remove("is-hidden");
        el.style.opacity = String(opacityFor(profileName));

        if (prefersReducedMotion()) {
            el.pause();
            return;
        }

        hookGestureResume(el);
        tryPlay(el);
    }

    function stop() {
        activeProfile = null;
        const el = getVideo();
        if (!el) {
            return;
        }
        el.pause();
        el.currentTime = 0;
        el.classList.add("is-hidden");
    }

    return { start, stop };
})();
