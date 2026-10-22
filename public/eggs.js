/* Two small surprises, kept rare on purpose.
   - Click a big sun five times quickly: a little face appears on it,
     winks, and the sun does a happy spin with a sparkle sound.
   - When it is snowing where you are looking, soft snow piles up on the
     tops of the frame's buttons, the green title block, and the pill.
   The face and caps are drawn here; nothing is borrowed artwork. */

const CirrusEggs = (function () {
    const SVG_NS = "http://www.w3.org/2000/svg";
    let deps = { sound: { play() {} } };
    let taps = [];
    let winking = false;

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function svgShape(tag, attributes) {
        const shape = document.createElementNS(SVG_NS, tag);
        Object.keys(attributes).forEach((name) => shape.setAttribute(name, attributes[name]));
        return shape;
    }

    // A tiny friendly face: two eyes (the right one can close), rosy
    // cheeks, and a smile, sized to sit on the sun's bright middle.
    function makeFace() {
        const face = svgShape("svg", { class: "sun-face", viewBox: "0 0 40 40", "aria-hidden": "true" });
        face.append(
            svgShape("circle", { class: "sun-face-cheek", cx: "9", cy: "23", r: "3.2" }),
            svgShape("circle", { class: "sun-face-cheek", cx: "31", cy: "23", r: "3.2" }),
            svgShape("ellipse", { class: "sun-face-eye", cx: "13.5", cy: "15.5", rx: "2.2", ry: "3" }),
            svgShape("ellipse", { class: "sun-face-eye sun-face-eye--open", cx: "26.5", cy: "15.5", rx: "2.2", ry: "3" }),
            svgShape("path", { class: "sun-face-wink", d: "M23.6 16.2 Q26.5 13.4 29.4 16.2" }),
            svgShape("path", { class: "sun-face-smile", d: "M13 23.5 Q20 30.5 27 23.5" }),
        );
        return face;
    }

    function wink(wrapper) {
        winking = true;
        const face = makeFace();
        wrapper.appendChild(face);
        wrapper.classList.add("is-winking");
        deps.sound.play("sparkle");
        const icon = wrapper.querySelector("img");
        if (!reducedMotion() && icon && icon.animate) {
            icon.animate([{ transform: "none" }, { transform: "rotate(360deg)" }], {
                duration: CirrusConfig.eggs.spinMs,
                easing: getComputedStyle(document.documentElement).getPropertyValue("--spring-pop").trim(),
                delay: CirrusConfig.eggs.spinDelayMs,
            });
        }
        setTimeout(() => {
            wrapper.classList.remove("is-winking");
            face.remove();
            winking = false;
        }, CirrusConfig.eggs.winkShowMs);
    }

    function onPress(event) {
        const icon = event.target && event.target.closest ? event.target.closest(".wx-icon[data-motion='sun'] img") : null;
        if (!icon || winking) {
            return;
        }
        const now = Date.now();
        const settings = CirrusConfig.eggs;
        taps = taps.filter((at) => now - at < settings.sunTapWindowMs);
        taps.push(now);
        if (taps.length >= settings.sunTaps) {
            taps = [];
            wink(icon.parentNode);
        }
    }

    // Snow (OpenWeather's 600s) piles little caps on the frame.
    function setWeather(conditionId) {
        const snowing = Math.floor(conditionId / 100) === 6;
        document.body.classList.toggle("is-snowing", snowing);
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        document.addEventListener("pointerdown", onPress);
    }

    return { init, setWeather };
})();
