/* The frame: silver button rows, the header title, and the up/down stack
   of views inside the blue panel. Views are the
   <section class="view" data-view="..."> elements, in page order.
   Sub-screens (search, settings, alert, day, globe) slide over the views
   and turn the bottom-left button into Back. */

const CirrusFrame = (function () {
    const VIEW_NAMES = {
        uv: "UV Index",
        current: "Current",
        today: "Today",
        tomorrow: "Tomorrow",
        fiveday: "5-Day Forecast",
        sixhour: "6-Hour Weather",
    };
    // Phones show these shorter names on the narrow middle buttons.
    const SHORT_NAMES = {
        fiveday: "5-Day",
        sixhour: "6-Hour",
    };
    const LONG_TITLE_CHARS = 9;
    const SWIPE_MIN_PX = 50;
    const DESKTOP_QUERY = "(min-width: 768px)";

    let deps = {
        onHome: null,
        onSettings: null,
        onGlobe: null,
        onViewChange: () => {},
        // called with the view or screen element that just opened
        onEnter: () => {},
        // plays a named sound: "chime" when something opens, "back" for Back
        onSound: () => {},
        prefersReducedMotion: () => false,
    };

    // the slide animation of the view track, while it is running
    let slide = null;

    // the scroll wheel: how far it has turned, whether it is waiting for a
    // flick to finish before it can move again, and how strong the fading
    // scroll is (so a new flick can be told apart from it)
    const wheel = { total: 0, lastAt: 0, movedAt: 0, waiting: false, fadeSize: 0, strongInARow: 0 };

    const state = {
        views: [],
        index: 0,
        titles: {},
        readouts: {},
        screen: null,
        asOf: "",
        visiting: false,
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function isDesktop() {
        return window.matchMedia(DESKTOP_QUERY).matches;
    }

    // Reads a duration token such as --dur-medium ("350ms") as milliseconds.
    function cssDuration(name) {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const value = parseFloat(raw);
        if (Number.isNaN(value)) {
            return 0;
        }
        if (raw.endsWith("ms")) {
            return value;
        }
        return value * 1000;
    }

    // Reads a CSS custom property as text, e.g. an easing curve.
    function cssValue(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function reducedMotion() {
        return deps.prefersReducedMotion();
    }

    // Plays a Web Animation when the browser supports it.
    function play(element, keyframes, options) {
        if (!element || !element.animate) {
            return null;
        }
        return element.animate(keyframes, options);
    }

    function fadeIn(element) {
        return play(element, [{ opacity: 0 }, { opacity: 1 }], {
            duration: cssDuration("--dur-fade-quick"),
            easing: cssValue("--ease-fade"),
        });
    }

    function currentViewElement() {
        return document.querySelectorAll(".view[data-view]")[state.index];
    }

    function currentViewId() {
        return state.views[state.index];
    }

    function hasView(id) {
        return state.views.includes(id);
    }

    // The name a neighbouring middle button shows, e.g. "6-Hour Weather".
    function viewName(id) {
        if (!isDesktop() && SHORT_NAMES[id]) {
            return SHORT_NAMES[id];
        }
        return VIEW_NAMES[id] || id;
    }

    // The header title, which a view may override (6-Hour shows a weekday).
    function viewTitle(id) {
        if (state.titles[id]) {
            return state.titles[id];
        }
        return VIEW_NAMES[id] || id;
    }

    function setTitle(text) {
        const title = byId("frameTitle");
        title.textContent = text;
        title.classList.toggle("is-long", text.length > LONG_TITLE_CHARS);
    }

    // Shows a label on a frame button, or turns it into an empty slot.
    function setSlot(button, label) {
        const labelEl = button.querySelector(".frame-btn-label");
        if (label) {
            button.disabled = false;
            button.classList.remove("is-empty");
            button.removeAttribute("aria-hidden");
            labelEl.textContent = label;
        } else {
            button.disabled = true;
            button.classList.add("is-empty");
            button.setAttribute("aria-hidden", "true");
            labelEl.textContent = "";
        }
    }

    function renderNav() {
        const up = byId("navUp");
        const down = byId("navDown");
        let upLabel = "";
        let downLabel = "";
        if (!state.screen) {
            if (state.index > 0) {
                upLabel = viewName(state.views[state.index - 1]);
            }
            if (state.index < state.views.length - 1) {
                downLabel = viewName(state.views[state.index + 1]);
            }
        }
        setSlot(up, upLabel);
        setSlot(down, downLabel);
        if (upLabel) {
            up.setAttribute("aria-label", "Previous view: " + VIEW_NAMES[state.views[state.index - 1]]);
        }
        if (downLabel) {
            down.setAttribute("aria-label", "Next view: " + VIEW_NAMES[state.views[state.index + 1]]);
        }
    }

    function renderCorners() {
        let backLabel = "";
        if (state.screen) {
            backLabel = "Back";
        } else if (state.visiting) {
            backLabel = "Back";
        } else if (isDesktop() && deps.onHome) {
            backLabel = "Home";
        }
        setSlot(byId("backButton"), backLabel);

        // While visiting a city from the globe, Settings and Globe step aside.
        let settingsLabel = "";
        if (deps.onSettings && !state.visiting) {
            settingsLabel = "Settings";
        }
        setSlot(byId("settingsButton"), settingsLabel);

        let globeLabel = "";
        if (deps.onGlobe && !state.visiting) {
            globeLabel = "Globe";
        }
        setSlot(byId("globeButton"), globeLabel);
    }

    // The footer shows only the wind line; the other readings sit in
    // bubbles inside each view.
    function applyReadout(readout) {
        const wind = byId("panelWind");
        if (!readout) {
            wind.classList.add("hidden");
            return;
        }
        byId("panelWindMain").textContent = readout.main;
        wind.classList.remove("hidden");
    }

    function renderChrome() {
        if (state.screen) {
            setTitle(state.screen.title);
            applyReadout(state.screen.readout || null);
        } else {
            setTitle(viewTitle(currentViewId()));
            applyReadout(state.readouts[currentViewId()] || null);
        }
        renderNav();
        renderCorners();
        const asOf = byId("panelAsOf");
        asOf.textContent = state.asOf;
        asOf.classList.toggle("hidden", !state.asOf);
    }

    /* ---------- Page dots: where you are in the stack ---------- */

    function buildDots() {
        const nav = byId("viewDots");
        nav.replaceChildren();
        state.views.forEach((id) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "view-dot";
            dot.setAttribute("aria-label", VIEW_NAMES[id] || id);
            const name = document.createElement("span");
            name.className = "view-dot-name";
            name.setAttribute("aria-hidden", "true");
            name.textContent = VIEW_NAMES[id] || id;
            dot.appendChild(name);
            dot.addEventListener("click", () => showView(id));
            nav.appendChild(dot);
        });
    }

    // Only the current dot is in the Tab order; arrow keys move between views.
    function renderDots() {
        const dots = [...byId("viewDots").children];
        const focused = document.activeElement;
        const dotHadFocus = dots.includes(focused);
        dots.forEach((dot, i) => {
            const current = i === state.index;
            dot.classList.toggle("is-current", current);
            if (current) {
                dot.setAttribute("aria-current", "true");
                dot.tabIndex = 0;
            } else {
                dot.removeAttribute("aria-current");
                dot.tabIndex = -1;
            }
        });
        if (dotHadFocus && dots[state.index]) {
            dots[state.index].focus();
        }
    }

    /* ---------- Moving between views ---------- */

    // Where the track is right now, even halfway through a slide.
    function currentTrackY(track, fallback) {
        const transform = getComputedStyle(track).transform;
        const match = /^matrix\(([^)]+)\)$/.exec(transform || "");
        if (!match) {
            return fallback;
        }
        return parseFloat(match[1].split(",")[5]);
    }

    // The track slides to the new view, runs a few pixels past it, and
    // settles back, so each view lands with a small bounce. With reduced
    // motion the new view simply fades in.
    function slideTrack(fromIndex) {
        const track = byId("panelTrack");
        const height = track.offsetHeight;
        if (!height || fromIndex === state.index) {
            return;
        }
        let from = -fromIndex * height;
        if (slide) {
            from = currentTrackY(track, from);
            slide.cancel();
            slide = null;
        }
        if (reducedMotion()) {
            fadeIn(currentViewElement());
            return;
        }
        const to = -state.index * height;
        let direction = -1;
        if (to > from) {
            direction = 1;
        }
        const settings = CirrusConfig.viewSlide;
        slide = play(track, [
            { transform: "translateY(" + from + "px)", easing: cssValue("--ease-slide") },
            {
                transform: "translateY(" + (to + direction * settings.overshootPx) + "px)",
                offset: settings.overshootAt,
                easing: cssValue("--ease-settle"),
            },
            { transform: "translateY(" + to + "px)" },
        ], { duration: cssDuration("--dur-view-slide") });
        if (slide) {
            slide.onfinish = () => {
                slide = null;
            };
        }
    }

    // The title, middle-button labels, and wind line arrive with the view:
    // direction 1 comes up from below, -1 down from above, 0 pops in place.
    function animateChrome(direction) {
        const title = byId("frameTitle");
        const wind = byId("panelWind");
        const labels = [byId("navUp"), byId("navDown")].map((button) => button.querySelector(".frame-btn-label"));
        if (reducedMotion()) {
            fadeIn(title);
            fadeIn(wind);
            return;
        }
        const chrome = CirrusConfig.chrome;
        const pop = { duration: cssDuration("--dur-spring-pop"), easing: cssValue("--spring-pop") };
        play(title, [
            { opacity: 0, transform: "translateY(" + direction * chrome.titleShiftPercent + "%)" },
            { opacity: 1, transform: "none" },
        ], pop);
        labels.forEach((label) => {
            play(label, [
                { opacity: 0, transform: "scale(" + chrome.labelFromScale + ")" },
                { opacity: 1, transform: "none" },
            ], pop);
        });
        play(wind, [
            { opacity: 0, transform: "translateX(" + chrome.windShiftPx + "px)" },
            { opacity: 1, transform: "none" },
        ], Object.assign({ delay: chrome.windDelayMs, fill: "backwards" }, pop));
    }

    function markActiveView() {
        document.querySelectorAll(".view[data-view]").forEach((view, i) => {
            const active = i === state.index;
            view.inert = !active;
            view.setAttribute("aria-hidden", String(!active));
        });
        byId("panelTrack").style.setProperty("--view-index", String(state.index));
        renderDots();
    }

    function showView(id) {
        const index = state.views.indexOf(id);
        if (index === -1) {
            return;
        }
        if (state.screen) {
            closeScreen();
        }
        const fromIndex = state.index;
        state.index = index;
        markActiveView();
        renderChrome();
        if (index !== fromIndex) {
            slideTrack(fromIndex);
            let direction = 1;
            if (index < fromIndex) {
                direction = -1;
            }
            animateChrome(direction);
            deps.onEnter(currentViewElement());
            deps.onSound("chime");
        }
        deps.onViewChange(id);
    }

    // Briefly lights a middle button so keyboard and swipe moves feel pressed.
    function flash(button) {
        if (deps.prefersReducedMotion()) {
            return;
        }
        button.classList.add("is-pressed");
        setTimeout(() => button.classList.remove("is-pressed"), cssDuration("--dur-medium"));
    }

    function step(direction, { feedback = false } = {}) {
        if (state.screen) {
            return;
        }
        const target = state.index + direction;
        if (target < 0 || target >= state.views.length) {
            return;
        }
        if (feedback) {
            if (direction < 0) {
                flash(byId("navUp"));
            } else {
                flash(byId("navDown"));
            }
        }
        showView(state.views[target]);
    }

    function next(options) {
        step(1, options);
    }

    function prev(options) {
        step(-1, options);
    }

    function screenElement(name) {
        return byId("screen" + name.charAt(0).toUpperCase() + name.slice(1));
    }

    // The transform that shrinks the whole panel onto one element (a 5-Day
    // column), so a screen can grow out of it and shrink back into it.
    function zoomOnto(origin) {
        const panel = byId("framePanel").getBoundingClientRect();
        const box = origin.getBoundingClientRect();
        const scale = Math.max(CirrusConfig.screens.zoomMinScale, box.width / panel.width);
        const x = box.left + box.width / 2 - (panel.left + panel.width / 2);
        const y = box.top + box.height / 2 - (panel.top + panel.height / 2);
        return "translate(" + x + "px, " + y + "px) scale(" + scale + ")";
    }

    function canZoomFrom(origin) {
        return origin && origin.isConnected && origin.getBoundingClientRect().width > 0;
    }

    // A screen pops in from slightly small, or grows out of what you clicked.
    function enterScreen(element, origin) {
        if (reducedMotion()) {
            fadeIn(element);
            return;
        }
        let from = "scale(" + CirrusConfig.screens.popFromScale + ")";
        if (canZoomFrom(origin)) {
            from = zoomOnto(origin);
        }
        play(element, [
            { opacity: 0, transform: from },
            { opacity: 1, offset: 0.3 },
            { opacity: 1, transform: "none" },
        ], { duration: cssDuration("--dur-spring-pop"), easing: cssValue("--spring-slide") });
    }

    // A closing screen stays on top while it shrinks away (back into its
    // column, if it came from one), then hides.
    function leaveScreen(element, origin) {
        let keyframes = [{ opacity: 1 }, { opacity: 0 }];
        let timing = { duration: cssDuration("--dur-fade-quick"), easing: cssValue("--ease-fade") };
        if (!reducedMotion()) {
            let to = "scale(" + CirrusConfig.screens.leaveToScale + ")";
            if (canZoomFrom(origin)) {
                to = zoomOnto(origin);
            }
            keyframes = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: to }];
            timing = { duration: cssDuration("--dur-exit"), easing: cssValue("--ease-exit") };
        }
        const animation = play(element, keyframes, timing);
        if (!animation) {
            element.classList.add("hidden");
            return;
        }
        element.classList.add("is-leaving");
        element.leaving = animation;
        animation.onfinish = () => {
            element.leaving = null;
            element.classList.remove("is-leaving");
            element.classList.add("hidden");
        };
    }

    // Stops a screen's exit (it is opening again) without hiding it.
    function stopLeaving(element) {
        if (element.leaving) {
            element.leaving.cancel();
            element.leaving = null;
        }
        element.classList.remove("is-leaving");
    }

    // options: { title, readout, onClose, onBack, origin }
    // onBack may return true to handle Back itself (e.g. detail -> list).
    // origin is an element the screen grows out of (a 5-Day column).
    function openScreen(name, options = {}) {
        const wasOpen = state.screen && state.screen.name === name;
        if (state.screen && state.screen.name !== name) {
            closeScreen();
        }
        const element = screenElement(name);
        document.querySelectorAll(".screen").forEach((screen) => {
            if (screen !== element) {
                stopLeaving(screen);
                screen.classList.add("hidden");
            }
        });
        if (element) {
            stopLeaving(element);
            element.classList.remove("hidden");
            element.scrollTop = 0;
            if (!wasOpen) {
                enterScreen(element, options.origin);
            }
        }
        state.screen = {
            name,
            title: options.title || "",
            readout: options.readout || null,
            onClose: options.onClose || null,
            onBack: options.onBack || null,
            origin: options.origin || null,
        };
        byId("frame").dataset.screen = name;
        if (element && element.classList.contains("screen--clear")) {
            byId("frame").dataset.clear = "true";
        } else {
            delete byId("frame").dataset.clear;
        }
        byId("panelViewport").inert = true;
        renderChrome();
        if (!wasOpen) {
            animateChrome(0);
            if (element) {
                deps.onEnter(element);
            }
            deps.onSound("chime");
        }
    }

    function updateScreen(options) {
        if (!state.screen) {
            return;
        }
        if (options.title !== undefined) {
            state.screen.title = options.title;
        }
        if (options.readout !== undefined) {
            state.screen.readout = options.readout;
        }
        renderChrome();
    }

    function closeScreen() {
        if (!state.screen) {
            return;
        }
        const closing = state.screen;
        state.screen = null;
        const element = screenElement(closing.name);
        if (element) {
            leaveScreen(element, closing.origin);
        }
        delete byId("frame").dataset.screen;
        delete byId("frame").dataset.clear;
        byId("panelViewport").inert = false;
        if (closing.onClose) {
            closing.onClose();
        }
        renderChrome();
        animateChrome(0);
    }

    function screenName() {
        if (state.screen) {
            return state.screen.name;
        }
        return null;
    }

    function back() {
        if (state.screen) {
            deps.onSound("back");
            if (state.screen.onBack && state.screen.onBack()) {
                return;
            }
            closeScreen();
            return;
        }
        if (state.visiting && deps.onEndVisit) {
            deps.onSound("back");
            deps.onEndVisit();
            return;
        }
        if (isDesktop() && deps.onHome) {
            deps.onSound("back");
            deps.onHome();
        }
    }

    function setVisiting(visiting) {
        state.visiting = visiting;
        renderChrome();
    }

    function setViewTitle(id, title) {
        state.titles[id] = title;
        renderChrome();
    }

    function setReadout(id, readout) {
        state.readouts[id] = readout;
        renderChrome();
    }

    function setAsOf(text) {
        state.asOf = text;
        renderChrome();
    }

    /* ---------- Clock ---------- */

    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let meridiem = "AM";
        if (hours >= 12) {
            meridiem = "PM";
        }
        hours = hours % 12;
        if (hours === 0) {
            hours = 12;
        }
        const minutes = String(now.getMinutes()).padStart(2, "0");
        byId("clockDigits").textContent = String(hours).padStart(2, "0") + ":" + minutes;
        byId("clockMeridiem").textContent = meridiem;
        byId("frameClock").setAttribute("aria-label", "Local time " + hours + ":" + minutes + " " + meridiem);
    }

    /* ---------- Keyboard, swipe, and scroll ---------- */

    function isTypingTarget(target) {
        if (!target || !target.tagName) {
            return false;
        }
        const tag = target.tagName.toLowerCase();
        return tag === "input" || tag === "textarea" || tag === "select";
    }

    function frameIsActive() {
        if (document.body.classList.contains("is-home") && isDesktop()) {
            return false;
        }
        const overlay = byId("alertOverlay");
        return !overlay || overlay.classList.contains("hidden");
    }

    function onKeydown(event) {
        if (!frameIsActive()) {
            return;
        }
        if (event.key === "Escape" && (state.screen || state.visiting)) {
            event.preventDefault();
            back();
            return;
        }
        if (isTypingTarget(event.target) || state.screen) {
            return;
        }
        if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            prev({ feedback: true });
        } else if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault();
            next({ feedback: true });
        }
    }

    function wireSwipe() {
        const viewport = byId("panelViewport");
        let start = null;
        viewport.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse") {
                return;
            }
            start = { x: event.clientX, y: event.clientY };
        });
        viewport.addEventListener("pointercancel", () => {
            start = null;
        });
        viewport.addEventListener("pointerup", (event) => {
            if (!start) {
                return;
            }
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            start = null;
            if (Math.abs(dy) < SWIPE_MIN_PX || Math.abs(dy) < Math.abs(dx) * 1.5) {
                return;
            }
            // Finger moving up pulls the next view up from below.
            if (dy < 0) {
                next({ feedback: true });
            } else {
                prev({ feedback: true });
            }
        });
    }

    // Scroll wheels report lines or pages in some browsers; turn them into pixels.
    function wheelPixels(event) {
        if (event.deltaMode === 1) {
            return event.deltaY * CirrusConfig.viewWheel.lineHeightPx;
        }
        if (event.deltaMode === 2) {
            return event.deltaY * byId("panelViewport").offsetHeight;
        }
        return event.deltaY;
    }

    // Scrolling over the frame moves one view per flick: down goes on to
    // the next view (Current, Today, Tomorrow...), up goes back. A trackpad
    // keeps sending smaller and smaller scrolls after a flick, so after each
    // move the wheel waits until the scrolling goes quiet, or until a
    // clearly stronger push shows that a new flick has started.
    function onWheel(event) {
        // pinch zoom keeps its usual meaning
        if (event.ctrlKey) {
            return;
        }
        const settings = CirrusConfig.viewWheel;
        const pixels = wheelPixels(event);
        const size = Math.abs(pixels);
        const now = event.timeStamp;
        // Open screens (settings, the globe) handle their own scrolling. Their
        // scrolls still count as recent, so a trackpad's leftover glide after
        // closing one has to go quiet before it can move a view.
        if (state.screen || !frameIsActive()) {
            wheel.lastAt = now;
            wheel.waiting = true;
            return;
        }
        // sideways scrolls are left alone
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            return;
        }
        const quiet = now - wheel.lastAt > settings.quietMs;
        // A new flick must be clearly stronger than the fading scroll for two
        // scrolls in a row. A single bump (two scrolls merged into one while
        // the page was busy) doesn't count.
        const strong = now - wheel.movedAt > settings.cooldownMs
            && size >= settings.newPushMinPx
            && size > wheel.fadeSize * settings.newPushRatio;
        if (strong) {
            wheel.strongInARow += 1;
        } else {
            wheel.strongInARow = 0;
            wheel.fadeSize = size;
        }
        if (quiet || (wheel.waiting && wheel.strongInARow >= 2)) {
            wheel.waiting = false;
            wheel.total = 0;
            wheel.strongInARow = 0;
        }
        wheel.lastAt = now;
        if (wheel.waiting) {
            event.preventDefault();
            return;
        }

        let direction = 1;
        if (pixels < 0) {
            direction = -1;
        }
        const target = state.index + direction;
        if (target < 0 || target >= state.views.length) {
            // already at the first or last view: let the page scroll as usual
            wheel.total = 0;
            return;
        }
        event.preventDefault();
        // A mouse wheel notch that starts a scroll counts as a whole step,
        // even when the browser reports only a few pixels for it (a slow
        // notch on a Mac). wheelDeltaY says 120 for every notch.
        let amount = pixels;
        if (quiet && Math.abs(event.wheelDeltaY || 0) >= settings.notchDelta) {
            amount = direction * settings.stepPx;
        }
        // turning the wheel the other way starts counting again
        if (wheel.total * amount < 0) {
            wheel.total = 0;
        }
        wheel.total += amount;
        if (Math.abs(wheel.total) < settings.stepPx) {
            return;
        }
        wheel.total = 0;
        wheel.waiting = true;
        wheel.movedAt = now;
        wheel.fadeSize = size;
        wheel.strongInARow = 0;
        step(direction, { feedback: true });
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        state.views = [...document.querySelectorAll(".view[data-view]")].map((view) => view.dataset.view);
        state.index = Math.max(0, state.views.indexOf("current"));

        byId("navUp").addEventListener("click", () => prev());
        byId("navDown").addEventListener("click", () => next());
        byId("backButton").addEventListener("click", back);
        byId("settingsButton").addEventListener("click", () => {
            if (deps.onSettings) {
                deps.onSettings();
            }
        });
        byId("globeButton").addEventListener("click", () => {
            if (deps.onGlobe) {
                deps.onGlobe();
            }
        });
        document.addEventListener("keydown", onKeydown);
        wireSwipe();
        byId("frame").addEventListener("wheel", onWheel, { passive: false });
        window.matchMedia(DESKTOP_QUERY).addEventListener("change", renderChrome);

        updateClock();
        setInterval(updateClock, 1000);
        buildDots();
        markActiveView();
        renderChrome();
    }

    // Lets later features (settings, globe) plug into the corner buttons.
    function setHandlers(handlers) {
        deps = Object.assign(deps, handlers);
        renderChrome();
    }

    return {
        init,
        setHandlers,
        showView,
        next,
        prev,
        hasView,
        currentViewId,
        openScreen,
        updateScreen,
        closeScreen,
        screenName,
        back,
        setVisiting,
        setViewTitle,
        setReadout,
        setAsOf,
        isDesktop,
        cssDuration,
    };
})();
