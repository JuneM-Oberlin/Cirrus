/* NWS severe weather alerts, shown the frame's way: a red (warning) or
   orange (watch / advisory) bar under the header, and an Alert screen
   whose header takes the same color. Severe alerts open the screen
   automatically once per search. */

const CirrusAlerts = (function () {
    const ALERT_KNOWN_TIERS = new Set(["warning", "watch", "advisory", "statement"]);
    const ALERT_TIER_LABELS = {
        warning: "Warning",
        watch: "Watch",
        advisory: "Advisory",
        statement: "Statement",
        unknown: "Alert",
    };
    const SVG_NS = "http://www.w3.org/2000/svg";

    let deps = {
        backendUrl: "",
        frame: null,
        show: () => {},
        hide: () => {},
        set: () => {},
        getTimezoneOffset: () => 0,
        formatCityTime: () => "--",
        onAlertsChanged: () => {},
        allowAutoPop: () => true,
        onBadgeOpen: () => {},
        // a warning arrived (once per search): the app plays a soft tone
        onWarning: () => {},
    };

    const session = {
        generation: 0,
        alerts: [],
        autoPopDismissed: false,
        warned: false,
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        const badge = byId("alertBadge");
        if (badge) {
            badge.addEventListener("click", () => deps.onBadgeOpen());
        }
    }

    function isStormThreatAlert(alert) {
        if (!alert || !alert.event) {
            return false;
        }
        const event = alert.event.toLowerCase();
        const isWatchOrWarning = alert.tier === "warning" || alert.tier === "watch";
        return isWatchOrWarning
            && (event.includes("thunderstorm") || event.includes("tornado"));
    }

    function getStormLightningRank() {
        const rank = { none: 0, heavy: 1, severe: 2 };
        let best = 0;
        session.alerts.forEach((alert) => {
            if (!isStormThreatAlert(alert)) {
                return;
            }
            const event = alert.event.toLowerCase();
            let intensity = "heavy";
            if (event.includes("tornado") || alert.tier === "warning") {
                intensity = "severe";
            }
            if (rank[intensity] > best) {
                best = rank[intensity];
            }
        });
        if (best === 2) {
            return "severe";
        }
        if (best === 1) {
            return "heavy";
        }
        return "none";
    }

    function normalizeAlertTier(tier) {
        if (ALERT_KNOWN_TIERS.has(tier)) {
            return tier;
        }
        return "unknown";
    }

    function alertTierLabel(tier) {
        return ALERT_TIER_LABELS[tier] || "Alert";
    }

    // Warnings paint the chrome red; everything else paints it orange.
    function colorFor(alerts) {
        if (alerts.some((alert) => alert.tier === "warning")) {
            return "warning";
        }
        return "watch";
    }

    function alertUntilText(alert) {
        let epoch = alert.expires;
        if (alert.ends > 0) {
            epoch = alert.ends;
        }
        if (!epoch) {
            return "";
        }
        return "Until " + deps.formatCityTime(epoch, deps.getTimezoneOffset());
    }

    function isScreenOpen() {
        return deps.frame && deps.frame.screenName() === "alert";
    }

    /* ---------- Fetching ---------- */

    async function fetchAlertSnapshot(lat, lon) {
        if (lat == null || lon == null) {
            return { alerts: [], error: false };
        }
        try {
            const url = `${deps.backendUrl}/alerts?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            // fallow-ignore-next-line security-sink -- backendUrl is same-origin or pinned HTTPS, and both coordinates are percent-encoded.
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok || data.error) {
                return { alerts: [], error: true };
            }
            let alerts = [];
            if (Array.isArray(data.alerts)) {
                alerts = data.alerts;
            }
            return { alerts, error: false };
        } catch (e) {
            console.log("Alerts fetch failed:", e);
            return { alerts: [], error: true };
        }
    }

    function resetForSearch() {
        session.generation += 1;
        session.autoPopDismissed = false;
        session.warned = false;
        session.alerts = [];
        deps.hide("alertFetchMsg");
        if (isScreenOpen()) {
            deps.frame.closeScreen();
        }
        renderBar();
        updateBadge();
    }

    function applyAlertSnapshot(snapshot) {
        if (snapshot.error) {
            session.alerts = [];
            deps.set("alertFetchMsg", "Couldn't check for weather alerts just now.");
            deps.show("alertFetchMsg");
        } else {
            session.alerts = snapshot.alerts;
            deps.hide("alertFetchMsg");
        }
        const hasWarning = session.alerts.some((alert) => normalizeAlertTier(alert.tier) === "warning");
        if (hasWarning && !session.warned) {
            session.warned = true;
            deps.onWarning();
        }
        renderBar();
        updateBadge();
        deps.onAlertsChanged();
        if (isScreenOpen()) {
            if (session.alerts.length) {
                renderList();
            } else {
                deps.frame.closeScreen();
            }
        }
    }

    function sync() {
        if (!session.alerts.length || isScreenOpen()) {
            return;
        }
        const shouldAutoPop = session.alerts.some((alert) => alert.autoPop)
            && !session.autoPopDismissed
            && deps.allowAutoPop();
        if (shouldAutoPop) {
            open();
        }
    }

    async function checkAlerts(weatherData) {
        const generation = session.generation;
        const snapshot = await fetchAlertSnapshot(weatherData.lat, weatherData.lon);
        if (generation !== session.generation) {
            return;
        }
        applyAlertSnapshot(snapshot);
        sync();
    }

    /* ---------- Bar under the header + Home badge ---------- */

    function triangleIcon() {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("class", "alert-icon");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", "M12 3 22 20H2Z");
        svg.appendChild(path);
        return svg;
    }

    function renderBar() {
        const slot = byId("frameAlertSlot");
        if (!slot) {
            return;
        }
        slot.replaceChildren();
        if (!session.alerts.length || isScreenOpen()) {
            return;
        }
        const first = session.alerts[0];
        const bar = document.createElement("button");
        bar.type = "button";
        bar.className = "alert-bar alert-bar--" + colorFor(session.alerts);

        const text = document.createElement("span");
        text.className = "alert-bar-text";
        let summary = first.event || "Weather alert";
        const until = alertUntilText(first);
        if (until) {
            summary += " · " + until.charAt(0).toLowerCase() + until.slice(1);
        }
        text.textContent = summary;

        const more = document.createElement("span");
        more.className = "alert-bar-more";
        if (session.alerts.length > 1) {
            more.textContent = "+" + (session.alerts.length - 1) + " more";
        } else {
            more.textContent = "Details";
        }

        bar.append(triangleIcon(), text, more);
        let countText = session.alerts.length + " active weather alert";
        if (session.alerts.length !== 1) {
            countText += "s";
        }
        bar.setAttribute("aria-label", countText + ": " + summary + ". Open alerts");
        bar.addEventListener("click", open);
        slot.appendChild(bar);
    }

    function updateBadge() {
        const badge = byId("alertBadge");
        if (!badge) {
            return;
        }
        if (session.alerts.length > 0) {
            byId("alertBadgeCount").textContent = String(session.alerts.length);
            badge.className = "home-badge home-badge--" + colorFor(session.alerts);
            badge.hidden = false;
        } else {
            badge.className = "home-badge hidden";
            badge.hidden = true;
        }
    }

    /* ---------- Alert screen ---------- */

    function sevBadge(tier) {
        const sev = document.createElement("span");
        sev.className = "alert-sev alert-sev--" + tier;
        sev.textContent = alertTierLabel(tier);
        return sev;
    }

    function renderList() {
        const list = byId("alertList");
        list.replaceChildren();
        const count = session.alerts.length;
        let heading = count + " active alert";
        if (count !== 1) {
            heading += "s";
        }
        byId("alertListHeading").textContent = heading;

        session.alerts.forEach((alert) => {
            const tier = normalizeAlertTier(alert.tier);
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip-btn alert-tile";

            const event = document.createElement("span");
            event.className = "alert-tile-event";
            event.textContent = alert.event || "Weather alert";
            button.append(sevBadge(tier), event);

            const until = alertUntilText(alert);
            if (until) {
                const untilEl = document.createElement("span");
                untilEl.className = "alert-tile-until";
                untilEl.textContent = until;
                button.appendChild(untilEl);
            }
            button.setAttribute("aria-label", alertTierLabel(tier) + ": " + (alert.event || "Weather alert") + ". " + until);
            button.addEventListener("click", () => showDetail(alert));
            item.appendChild(button);
            list.appendChild(item);
        });
    }

    function showDetail(alert) {
        const detail = byId("alertDetail");
        detail.replaceChildren();
        const tier = normalizeAlertTier(alert.tier);

        const title = document.createElement("h3");
        title.className = "alert-detail-event";
        title.textContent = alert.event || "Weather alert";

        const meta = document.createElement("p");
        meta.className = "alert-detail-meta";
        meta.appendChild(sevBadge(tier));
        const until = alertUntilText(alert);
        if (until) {
            const u = document.createElement("span");
            u.textContent = until;
            meta.appendChild(u);
        }
        detail.append(title, meta);

        if (alert.senderName) {
            const office = document.createElement("p");
            office.className = "alert-detail-office";
            office.textContent = alert.senderName;
            detail.appendChild(office);
        }
        if (alert.description) {
            const desc = document.createElement("p");
            desc.className = "alert-detail-desc";
            desc.textContent = alert.description;
            detail.appendChild(desc);
        }
        if (alert.instruction) {
            const instr = document.createElement("p");
            instr.className = "alert-detail-instruction";
            instr.textContent = alert.instruction;
            detail.appendChild(instr);
        }

        byId("alertListWrap").classList.add("hidden");
        detail.classList.remove("hidden");
        byId("screenAlert").scrollTop = 0;
        title.tabIndex = -1;
        title.focus();
    }

    function hideDetail() {
        byId("alertDetail").classList.add("hidden");
        byId("alertListWrap").classList.remove("hidden");
    }

    function setHeaderColor(color) {
        const header = byId("frameHeader");
        header.classList.remove("frame-header--warning", "frame-header--watch");
        if (color) {
            header.classList.add("frame-header--" + color);
        }
    }

    // Back from an alert's details returns to the list first.
    function onScreenBack() {
        if (!byId("alertDetail").classList.contains("hidden")) {
            hideDetail();
            const first = byId("alertList").querySelector("button");
            if (first) {
                first.focus();
            }
            return true;
        }
        return false;
    }

    function onScreenClose() {
        session.autoPopDismissed = true;
        setHeaderColor("");
        hideDetail();
        renderBar();
    }

    function open() {
        if (!session.alerts.length || !deps.frame) {
            return;
        }
        hideDetail();
        renderList();
        deps.frame.openScreen("alert", {
            title: "Weather Alert",
            onClose: onScreenClose,
            onBack: onScreenBack,
        });
        setHeaderColor(colorFor(session.alerts));
        renderBar();
        const first = byId("alertList").querySelector("button");
        if (first) {
            first.focus();
        }
    }

    return {
        init,
        resetForSearch,
        checkAlerts,
        sync,
        syncOverlay: sync,
        getStormLightningRank,
        open,
        openOverlay: open,
    };
})();
