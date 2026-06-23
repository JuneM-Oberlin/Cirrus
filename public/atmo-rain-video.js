/* Rain atmosphere — looping video overlay over the globe */

const AtmoRainVideo = (function () {
    const OPACITY = {
        drizzle: 0.06,
        rain: 0.09,
        "rain-heavy": 0.13,
        sleet: 0.08,
    };

    let video = null;

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function getVideo() {
        if (!video) {
            video = document.getElementById("atmoRainVideo");
        }
        return video;
    }

    function start(profileName) {
        const el = getVideo();
        if (!el) {
            return;
        }

        el.classList.remove("is-hidden");
        el.style.opacity = String(OPACITY[profileName] ?? OPACITY.rain);

        if (prefersReducedMotion()) {
            el.pause();
            return;
        }

        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }

    function stop() {
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
