/* Opening a channel feels like the console launching it. On desktop the
   Home tile you chose grows to fill the screen while the frame comes out
   of it, and Back to Home shrinks the frame back into that tile. Phones
   have no Home menu, so a Cirrus tile does the same once as the app
   opens. Reduced motion swaps every zoom for a short fade. */

const CirrusLaunch = (function () {
    let lastTile = null;  // the tile the frame was launched from
    let running = [];     // animations of the zoom in progress
    let ghost = null;     // the copy of the tile that grows or shrinks

    function byId(id) {
        return document.getElementById(id);
    }

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function cssValue(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function cssMs(name) {
        const raw = cssValue(name);
        const value = parseFloat(raw);
        if (raw.endsWith("ms")) {
            return value;
        }
        return value * 1000;
    }

    // Ends a zoom early (a quick second click) and tidies up.
    function finish() {
        running.forEach((animation) => animation.cancel());
        running = [];
        if (ghost) {
            ghost.remove();
            ghost = null;
        }
        document.body.classList.remove("is-launching", "is-returning");
    }

    // A copy of the tile pinned over the real one, so it can grow while
    // the menu underneath stays where it is.
    function makeGhost(tile, rect) {
        const copy = tile.cloneNode(true);
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
        copy.classList.add("launch-ghost");
        copy.setAttribute("aria-hidden", "true");
        copy.tabIndex = -1;
        copy.style.left = rect.left + "px";
        copy.style.top = rect.top + "px";
        copy.style.width = rect.width + "px";
        copy.style.height = rect.height + "px";
        document.body.appendChild(copy);
        return copy;
    }

    // Moves and stretches a box at rect so it covers the whole window.
    function coverFrom(rect) {
        const scaleX = window.innerWidth / rect.width;
        const scaleY = window.innerHeight / rect.height;
        const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
        return "translate(" + dx + "px, " + dy + "px) scale(" + scaleX + ", " + scaleY + ")";
    }

    // Shrinks the whole window evenly onto rect.
    function shrinkOnto(rect) {
        const scale = Math.max(rect.width / window.innerWidth, rect.height / window.innerHeight);
        const dx = rect.left + rect.width / 2 - window.innerWidth / 2;
        const dy = rect.top + rect.height / 2 - window.innerHeight / 2;
        return "translate(" + dx + "px, " + dy + "px) scale(" + scale + ")";
    }

    function fade(element, from, to) {
        const animation = element.animate([{ opacity: from }, { opacity: to }], {
            duration: cssMs("--dur-fade-quick"),
            easing: cssValue("--ease-fade"),
        });
        running.push(animation);
        animation.onfinish = finish;
    }

    // show() switches the page from Home to the frame.
    function openFrom(tile, show) {
        finish();
        lastTile = tile;
        const frame = byId("frame");
        if (!tile || !frame.animate) {
            show();
            return;
        }
        const rect = tile.getBoundingClientRect();
        // Home stays painted under the frame until the zoom ends
        document.body.classList.add("is-launching");
        show();
        if (reducedMotion()) {
            fade(frame, 0, 1);
            return;
        }
        ghost = makeGhost(tile, rect);
        const timing = { duration: cssMs("--dur-launch"), easing: cssValue("--ease-launch") };
        running = [
            ghost.animate([
                { transform: "none", opacity: 1 },
                { opacity: 1, offset: 0.4 },
                { transform: coverFrom(rect), opacity: 0 },
            ], timing),
            frame.animate([
                { transform: shrinkOnto(rect), opacity: 0 },
                { opacity: 0, offset: 0.25 },
                { opacity: 1, offset: 0.7 },
                { transform: "none", opacity: 1 },
            ], timing),
            byId("desktopChannels").animate([
                { transform: "none", opacity: 1 },
                { transform: "scale(" + cssValue("--launch-zoom-past") + ")", opacity: 0 },
            ], { duration: timing.duration * 0.6, easing: cssValue("--ease-exit"), fill: "forwards" }),
        ];
        running[1].onfinish = finish;
    }

    // hide() switches the page from the frame back to Home.
    function closeTo(hide) {
        finish();
        const frame = byId("frame");
        // Home comes back on top of the frame as the frame shrinks away
        document.body.classList.add("is-launching", "is-returning");
        hide();
        let tile = lastTile;
        if (!tile || !tile.isConnected) {
            tile = document.querySelector(".channel-tile--today");
        }
        if (!tile || !frame.animate) {
            finish();
            return;
        }
        const home = byId("desktopChannels");
        if (reducedMotion()) {
            fade(home, 0, 1);
            return;
        }
        const rect = tile.getBoundingClientRect();
        ghost = makeGhost(tile, rect);
        const timing = { duration: cssMs("--dur-launch"), easing: cssValue("--ease-launch") };
        running = [
            ghost.animate([
                { transform: coverFrom(rect), opacity: 0 },
                { opacity: 1, offset: 0.6 },
                { transform: "none", opacity: 1 },
            ], timing),
            frame.animate([
                { transform: "none", opacity: 1 },
                { opacity: 1, offset: 0.3 },
                { transform: shrinkOnto(rect), opacity: 0 },
            ], Object.assign({ fill: "forwards" }, timing)),
            home.animate([
                { transform: "scale(" + cssValue("--launch-zoom-past") + ")", opacity: 0 },
                { transform: "none", opacity: 1 },
            ], timing),
        ];
        running[0].onfinish = finish;
    }

    // Phones: a Cirrus tile pops up and grows into the frame as the app opens.
    function playIntro() {
        const frame = byId("frame");
        if (!frame.animate) {
            return;
        }
        if (reducedMotion()) {
            fade(frame, 0, 1);
            return;
        }
        const settings = CirrusConfig.launch;
        const splash = document.createElement("div");
        splash.className = "launch-splash";
        splash.setAttribute("aria-hidden", "true");
        const tile = document.createElement("div");
        tile.className = "launch-tile";
        const icon = document.createElement("img");
        icon.className = "launch-tile-icon";
        icon.src = "icons/clear-day.png";
        icon.alt = "";
        const name = document.createElement("span");
        name.className = "launch-tile-name";
        name.textContent = "Cirrus";
        tile.append(icon, name);
        splash.appendChild(tile);
        document.body.appendChild(splash);

        const pop = tile.animate([
            { transform: "scale(" + settings.popFromScale + ")", opacity: 0 },
            { transform: "none", opacity: 1 },
        ], { duration: settings.popMs, easing: cssValue("--spring-pop"), fill: "both" });

        pop.onfinish = () => {
            const rect = tile.getBoundingClientRect();
            const timing = { duration: cssMs("--dur-launch"), easing: cssValue("--ease-launch"), delay: settings.holdMs };
            const grow = tile.animate([
                { transform: "none", opacity: 1 },
                { opacity: 1, offset: 0.4 },
                { transform: coverFrom(rect), opacity: 0 },
            ], Object.assign({ fill: "forwards" }, timing));
            splash.animate([
                { opacity: 1 },
                { opacity: 1, offset: 0.35 },
                { opacity: 0 },
            ], Object.assign({ fill: "forwards" }, timing));
            frame.animate([
                { transform: "scale(" + settings.frameFromScale + ")", opacity: 0 },
                { opacity: 1, offset: 0.6 },
                { transform: "none", opacity: 1 },
            ], Object.assign({ fill: "backwards" }, timing));
            grow.onfinish = () => splash.remove();
        };
    }

    return { openFrom, closeTo, playIntro };
})();
