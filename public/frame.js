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
    const LONG_TITLE_CHARS = 9;
    const SWIPE_MIN_PX = 50;
    const DESKTOP_QUERY = "(min-width: 768px)";

    let deps = {
        onHome: null,
        onSettings: null,
        onGlobe: null,
        onViewChange: () => {},
        prefersReducedMotion: () => false,
    };

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

    function currentViewId() {
        return state.views[state.index];
    }

    function hasView(id) {
        return state.views.includes(id);
    }

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
                upLabel = viewTitle(state.views[state.index - 1]);
            }
            if (state.index < state.views.length - 1) {
                downLabel = viewTitle(state.views[state.index + 1]);
            }
        }
        setSlot(up, upLabel);
        setSlot(down, downLabel);
        if (upLabel) {
            up.setAttribute("aria-label", "Previous view: " + upLabel);
        }
        if (downLabel) {
            down.setAttribute("aria-label", "Next view: " + downLabel);
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

    function applyReadout(readout) {
        const wind = byId("panelWind");
        const main = byId("panelWindMain");
        const sub = byId("panelWindSub");
        if (!readout) {
            wind.classList.add("hidden");
            return;
        }
        main.textContent = readout.main;
        sub.replaceChildren();
        (readout.stats || []).forEach((stat) => {
            const span = document.createElement("span");
            span.className = "panel-stat";
            if (stat.extra) {
                span.classList.add("panel-stat--extra");
            }
            span.textContent = stat.text;
            sub.appendChild(span);
        });
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

    function markActiveView() {
        document.querySelectorAll(".view[data-view]").forEach((view, i) => {
            const active = i === state.index;
            view.inert = !active;
            view.setAttribute("aria-hidden", String(!active));
        });
        byId("panelTrack").style.setProperty("--view-index", String(state.index));
    }

    function showView(id) {
        const index = state.views.indexOf(id);
        if (index === -1) {
            return;
        }
        if (state.screen) {
            closeScreen();
        }
        state.index = index;
        markActiveView();
        renderChrome();
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

    // options: { title, readout, onClose }
    function openScreen(name, options = {}) {
        if (state.screen && state.screen.name !== name) {
            closeScreen();
        }
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.add("hidden"));
        const element = screenElement(name);
        if (element) {
            element.classList.remove("hidden");
            element.scrollTop = 0;
        }
        state.screen = {
            name,
            title: options.title || "",
            readout: options.readout || null,
            onClose: options.onClose || null,
        };
        byId("frame").dataset.screen = name;
        byId("panelViewport").inert = true;
        renderChrome();
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
            element.classList.add("hidden");
        }
        delete byId("frame").dataset.screen;
        byId("panelViewport").inert = false;
        if (closing.onClose) {
            closing.onClose();
        }
        renderChrome();
    }

    function screenName() {
        if (state.screen) {
            return state.screen.name;
        }
        return null;
    }

    function back() {
        if (state.screen) {
            closeScreen();
            return;
        }
        if (state.visiting && deps.onEndVisit) {
            deps.onEndVisit();
            return;
        }
        if (isDesktop() && deps.onHome) {
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

    /* ---------- Keyboard and swipe ---------- */

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
        window.matchMedia(DESKTOP_QUERY).addEventListener("change", renderChrome);

        updateClock();
        setInterval(updateClock, 1000);
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
