/* Random lightning strike overlays during thunder weather */

const AtmoLightning = (function () {
    const SRC = "media/lightning-strike.png";
    const PROFILES = {
        normal: { minMs: 4200, maxMs: 9000, doubleChance: 0.22 },
        heavy: { minMs: 2800, maxMs: 6500, doubleChance: 0.38 },
        severe: { minMs: 2000, maxMs: 5000, doubleChance: 0.48 },
    };

    let layer = null;
    let timer = null;
    let active = false;
    let profile = PROFILES.normal;

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function getLayer() {
        if (!layer) {
            layer = document.getElementById("atmoLightningLayer");
        }
        return layer;
    }

    function profileForCondition(conditionId) {
        const intensity = typeof thunderIconIntensity === "function"
            ? thunderIconIntensity(conditionId)
            : "none";

        switch (intensity) {
            case "severe":
                return PROFILES.severe;
            case "heavy":
                return PROFILES.heavy;
            default:
                return PROFILES.normal;
        }
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function flashSky() {
        const el = getLayer();
        if (!el) {
            return;
        }
        el.classList.add("atmo-lightning-flash");
        window.setTimeout(() => el.classList.remove("atmo-lightning-flash"), 140);
    }

    function spawnStrike(offsetX = 0, offsetY = 0) {
        const container = getLayer();
        if (!container || !active) {
            return;
        }

        const img = document.createElement("img");
        img.src = `${SRC}?t=${Date.now()}-${Math.random()}`;
        img.alt = "";
        img.className = "atmo-lightning-strike";
        img.setAttribute("aria-hidden", "true");
        img.decoding = "async";

        const scale = rand(0.45, 1.2);
        const heightPx = Math.round(rand(160, 380) * scale);
        const left = Math.min(82, Math.max(4, rand(6, 72) + offsetX));
        const top = Math.min(38, Math.max(0, rand(0, 28) + offsetY));
        const rotation = rand(-10, 10);

        img.style.left = `${left}%`;
        img.style.top = `${top}%`;
        img.style.height = `${heightPx}px`;
        img.style.width = "auto";
        img.style.opacity = String(rand(0.78, 0.98));
        img.style.transform = `rotate(${rotation}deg)`;

        container.appendChild(img);
        flashSky();

        window.setTimeout(() => img.remove(), 900);
    }

    function strikeBurst() {
        if (!active) {
            return;
        }
        spawnStrike();
        if (Math.random() < profile.doubleChance) {
            window.setTimeout(() => {
                if (active) {
                    spawnStrike(rand(-12, 12), rand(-8, 8));
                }
            }, rand(120, 320));
        }
    }

    function scheduleNext() {
        if (!active) {
            return;
        }
        const delay = rand(profile.minMs, profile.maxMs);
        timer = window.setTimeout(() => {
            strikeBurst();
            scheduleNext();
        }, delay);
    }

    function start(conditionId) {
        if (prefersReducedMotion()) {
            return;
        }

        const el = getLayer();
        if (!el) {
            return;
        }

        stop();
        active = true;
        profile = profileForCondition(conditionId);
        el.classList.remove("is-hidden");

        window.setTimeout(() => {
            if (active) {
                strikeBurst();
            }
        }, rand(600, 2200));

        scheduleNext();
    }

    function stop() {
        active = false;
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
        const el = getLayer();
        if (el) {
            el.classList.add("is-hidden");
            el.classList.remove("atmo-lightning-flash");
            el.replaceChildren();
        }
    }

    return { start, stop };
})();
