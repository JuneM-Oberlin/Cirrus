const CirrusAlerts = (function () {
    const CLOSE_FALLBACK_MS = 600;
    const ALERT_KNOWN_TIERS = new Set(["warning", "watch", "advisory", "statement"]);
    const ALERT_TIER_LABELS = {
        warning: "Warning",
        watch: "Watch",
        advisory: "Advisory",
        statement: "Statement",
        unknown: "Alert",
    };

    const ALERT_SEG_ICONS = {
        pin: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
        alert: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 22 20 2 20Z"/><rect x="11" y="9" width="2" height="6" rx="1" fill="#0c3247"/><rect x="11" y="16" width="2" height="2" rx="1" fill="#0c3247"/></svg>',
        clock: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        source: '<svg class="alert-seg-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9M16.5 7.5a6.5 6.5 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    };

    let backendUrl = "";
    let showEl = () => {};
    let hideEl = () => {};
    let setEl = () => {};
    let getTimezoneOffset = () => 0;
    let formatCityTime = () => "--";
    let prefersReducedMotion = () => false;
    let onAlertsChanged = () => {};
    let allowAutoPop = () => true;

    let closeFallbackTimer = null;
    let closeAnimationListener = null;
    let closeAnimationOverlay = null;

    const session = {
        generation: 0,
        alerts: [],
        autoPopDismissed: false,
        detailId: null,
        closing: false,
        lastFocused: null,
    };

    function init(deps) {
        backendUrl = deps.backendUrl;
        showEl = deps.show;
        hideEl = deps.hide;
        setEl = deps.set;
        getTimezoneOffset = deps.getTimezoneOffset;
        formatCityTime = deps.formatCityTime;
        prefersReducedMotion = deps.prefersReducedMotion;
        onAlertsChanged = deps.onAlertsChanged;
        allowAutoPop = deps.allowAutoPop ?? (() => true);
        wireControls();
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
            const intensity = event.includes("tornado") || alert.tier === "warning"
                ? "severe"
                : "heavy";
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

    function resetForSearch() {
        session.generation += 1;
        hideAlertFetchError();
        session.autoPopDismissed = false;
        session.alerts = [];
        updateAlertBadge();
        closeAlertOverlaySilently();
    }

    async function fetchAlertSnapshot(lat, lon) {
        if (lat == null || lon == null) {
            return { alerts: [], error: false };
        }
        try {
            const url = `${backendUrl}/alerts?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok || data.error) {
                return { alerts: [], error: true };
            }
            const alerts = Array.isArray(data.alerts) ? data.alerts : [];
            return { alerts, error: false };
        } catch (e) {
            console.log("Alerts fetch failed:", e);
            return { alerts: [], error: true };
        }
    }

    function applyAlertSnapshot(snapshot) {
        session.alerts = snapshot.error ? [] : snapshot.alerts;
        updateAlertBadge();
        onAlertsChanged();

        if (snapshot.error) {
            showAlertFetchError("Could not load weather alerts. Badge counts may be unavailable.");
            closeAlertOverlaySilently();
            return;
        }

        hideAlertFetchError();

        if (!snapshot.alerts.length) {
            closeAlertOverlaySilently();
        }
    }

    function syncAlertOverlay() {
        if (!session.alerts.length) {
            return;
        }
        if (isAlertOverlayOpen()) {
            refreshAlertOverlayContent();
            return;
        }
        const shouldAutoPop = session.alerts.some((alert) => alert.autoPop)
            && !session.autoPopDismissed
            && allowAutoPop();
        if (shouldAutoPop) {
            openAlertOverlay();
        }
    }

    async function checkAlerts(weatherData) {
        const generation = session.generation;
        const snapshot = await fetchAlertSnapshot(weatherData.lat, weatherData.lon);
        if (generation !== session.generation) {
            return;
        }
        applyAlertSnapshot(snapshot);
        syncAlertOverlay();
    }

    function showAlertFetchError(message) {
        setEl("alertFetchMsg", message);
        showEl("alertFetchMsg");
    }

    function hideAlertFetchError() {
        hideEl("alertFetchMsg");
    }

    function isAlertOverlayOpen() {
        const overlay = document.getElementById("alertOverlay");
        return overlay && !overlay.classList.contains("hidden") && !overlay.hidden;
    }

    function refreshAlertOverlayContent() {
        if (!isAlertOverlayOpen() || !session.alerts.length) {
            return;
        }
        const preservedId = session.detailId;
        renderAlertChannels();
        renderAlertStrip();
        updateAlertMenuHeader();
        if (preservedId) {
            const still = session.alerts.find((alert) => alert.id === preservedId);
            if (still) {
                showAlertDetail(still, { focus: false });
                return;
            }
        }
        hideAlertDetail();
    }

    function normalizeAlertTier(tier) {
        return ALERT_KNOWN_TIERS.has(tier) ? tier : "unknown";
    }

    function alertTierLabel(tier) {
        return ALERT_TIER_LABELS[tier] || "Alert";
    }

    function alertShortEvent(event) {
        if (typeof event !== "string") {
            return "Alert";
        }
        return event.replace(/\s+(Warning|Watch|Advisory|Statement)$/i, "").trim() || event;
    }

    function alertUntilText(alert) {
        const epoch = alert.ends > 0 ? alert.ends : alert.expires;
        if (!epoch) {
            return "";
        }
        return "Until " + formatCityTime(epoch, getTimezoneOffset());
    }

    function renderAlertChannels() {
        const wrap = document.getElementById("alertChannels");
        if (!wrap) {
            return;
        }
        wrap.replaceChildren();

        session.alerts.forEach((alert) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pill alert-channel";

            const tier = normalizeAlertTier(alert.tier);
            const sev = document.createElement("span");
            sev.className = `alert-sev alert-sev--${tier}`;
            sev.textContent = alertTierLabel(tier);

            const event = document.createElement("span");
            event.className = "alert-ch-event";
            event.textContent = alertShortEvent(alert.event);

            btn.appendChild(sev);
            btn.appendChild(event);

            const until = alertUntilText(alert);
            if (until) {
                const untilEl = document.createElement("span");
                untilEl.className = "alert-ch-until";
                untilEl.textContent = until;
                btn.appendChild(untilEl);
            }

            btn.setAttribute("aria-label", `${alertTierLabel(tier)}: ${alert.event}`);
            btn.addEventListener("click", () => showAlertDetail(alert));
            wrap.appendChild(btn);
        });
    }

    function setAlertCenterDetailMode(active) {
        const center = document.getElementById("alertCenter");
        center?.classList.toggle("alert-center--detail", active);
    }

    function showAlertDetail(alert, { focus = true } = {}) {
        const body = document.getElementById("alertDetailBody");
        const channels = document.getElementById("alertChannels");
        const detail = document.getElementById("alertDetail");
        const back = document.getElementById("alertBack");
        if (!body || !channels || !detail) {
            return;
        }

        session.detailId = alert.id;
        body.replaceChildren();

        const title = document.createElement("div");
        title.className = "alert-detail-event";
        title.textContent = alert.event;
        body.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "alert-detail-meta";
        const tier = normalizeAlertTier(alert.tier);
        const sev = document.createElement("span");
        sev.className = `alert-sev alert-sev--${tier}`;
        sev.textContent = alertTierLabel(tier);
        meta.appendChild(sev);
        const until = alertUntilText(alert);
        if (until) {
            const u = document.createElement("span");
            u.textContent = until;
            meta.appendChild(u);
        }
        body.appendChild(meta);

        if (alert.senderName) {
            const office = document.createElement("div");
            office.className = "alert-detail-office";
            office.textContent = alert.senderName;
            body.appendChild(office);
        }

        if (alert.description) {
            const desc = document.createElement("div");
            desc.className = "alert-detail-desc";
            desc.textContent = alert.description;
            body.appendChild(desc);
        }

        if (alert.instruction) {
            const instr = document.createElement("div");
            instr.className = "alert-detail-instruction";
            instr.textContent = alert.instruction;
            body.appendChild(instr);
        }

        channels.classList.add("hidden");
        detail.classList.remove("hidden");
        detail.hidden = false;
        setAlertCenterDetailMode(true);
        if (focus && back) {
            back.focus();
        }
    }

    function hideAlertDetail() {
        session.detailId = null;
        const detail = document.getElementById("alertDetail");
        const channels = document.getElementById("alertChannels");
        if (!detail || !channels) {
            return;
        }
        detail.classList.add("hidden");
        detail.hidden = true;
        setAlertCenterDetailMode(false);
        channels.classList.remove("hidden");
    }

    function makeAlertSeg(iconName) {
        const seg = document.createElement("div");
        seg.className = "alert-seg";
        const svg = ALERT_SEG_ICONS[iconName];
        if (svg) {
            const ic = document.createElement("span");
            ic.style.display = "inline-flex";
            ic.innerHTML = svg;
            seg.appendChild(ic);
        }
        return seg;
    }

    function appendAlertSegText(seg, text, bold) {
        if (bold) {
            const b = document.createElement("b");
            b.textContent = text;
            seg.appendChild(b);
        } else {
            seg.appendChild(document.createTextNode(text));
        }
    }

    function renderAlertStrip() {
        const strip = document.getElementById("alertStrip");
        if (!strip) {
            return;
        }
        strip.replaceChildren();

        const first = session.alerts[0] || {};
        const county = first.areaDesc ? first.areaDesc.split(";")[0].trim() : "Your area";
        const count = session.alerts.length;
        const until = alertUntilText(first);

        const segCounty = makeAlertSeg("pin");
        appendAlertSegText(segCounty, county, true);
        strip.appendChild(segCounty);

        const segCount = makeAlertSeg("alert");
        appendAlertSegText(segCount, String(count), true);
        appendAlertSegText(segCount, count === 1 ? " alert" : " alerts", false);
        strip.appendChild(segCount);

        const segUntil = makeAlertSeg("clock");
        appendAlertSegText(segUntil, until || "In effect", false);
        strip.appendChild(segUntil);

        const segSource = makeAlertSeg("source");
        appendAlertSegText(segSource, "NWS", true);
        strip.appendChild(segSource);
    }

    function updateAlertMenuHeader() {
        const sub = document.getElementById("alertMenuSub");
        if (!sub) {
            return;
        }
        const n = session.alerts.length;
        sub.textContent = `${n} active alert${n === 1 ? "" : "s"}`;
    }

    function updateAlertBadge() {
        const badge = document.getElementById("alertBadge");
        if (!badge) {
            return;
        }
        if (session.alerts.length > 0) {
            document.getElementById("alertBadgeCount").textContent = session.alerts.length;
            badge.setAttribute("data-tier", normalizeAlertTier(session.alerts[0].tier));
            badge.classList.remove("hidden");
            badge.hidden = false;
        } else {
            badge.classList.add("hidden");
            badge.hidden = true;
        }
    }

    function openAlertOverlay() {
        if (!session.alerts.length) {
            return;
        }
        const overlay = document.getElementById("alertOverlay");
        const closeBtn = document.getElementById("alertClose");
        if (!overlay || !closeBtn) {
            return;
        }
        const wasClosed = overlay.classList.contains("hidden");

        clearCloseFallbackTimer();
        clearCloseAnimationListener();
        session.closing = false;
        overlay.classList.remove("alert-closing");

        if (wasClosed) {
            session.lastFocused = document.activeElement;
            overlay.classList.remove("hidden");
            overlay.hidden = false;
            document.addEventListener("keydown", onAlertKeydown);
        }

        refreshAlertOverlayContent();
        closeBtn.focus();
    }

    function clearCloseFallbackTimer() {
        if (closeFallbackTimer !== null) {
            clearTimeout(closeFallbackTimer);
            closeFallbackTimer = null;
        }
    }

    function clearCloseAnimationListener() {
        if (closeAnimationListener && closeAnimationOverlay) {
            closeAnimationOverlay.removeEventListener("animationend", closeAnimationListener);
            closeAnimationListener = null;
            closeAnimationOverlay = null;
        }
    }

    function finishCloseAlertOverlay(overlay) {
        clearCloseFallbackTimer();
        clearCloseAnimationListener();
        overlay.classList.remove("alert-closing");
        overlay.classList.add("hidden");
        overlay.hidden = true;
        session.closing = false;
        hideAlertDetail();
        document.removeEventListener("keydown", onAlertKeydown);
        updateAlertBadge();
        if (session.lastFocused && typeof session.lastFocused.focus === "function") {
            session.lastFocused.focus();
        }
    }

    function closeAlertOverlaySilently() {
        const overlay = document.getElementById("alertOverlay");
        if (!overlay || overlay.classList.contains("hidden")) {
            return;
        }

        if (prefersReducedMotion() || session.closing) {
            finishCloseAlertOverlay(overlay);
            return;
        }

        session.closing = true;
        overlay.classList.add("alert-closing");

        const onClosed = (event) => {
            if (event.target !== overlay || event.animationName !== "alertScrimOut") {
                return;
            }
            finishCloseAlertOverlay(overlay);
        };
        closeAnimationListener = onClosed;
        closeAnimationOverlay = overlay;
        overlay.addEventListener("animationend", onClosed);

        clearCloseFallbackTimer();
        closeFallbackTimer = setTimeout(() => {
            closeFallbackTimer = null;
            if (!session.closing) {
                return;
            }
            finishCloseAlertOverlay(overlay);
        }, CLOSE_FALLBACK_MS);
    }

    function dismissAlertOverlay() {
        session.autoPopDismissed = true;
        closeAlertOverlaySilently();
    }

    function onAlertKeydown(event) {
        if (event.key === "Escape") {
            dismissAlertOverlay();
            return;
        }
        if (event.key !== "Tab") {
            return;
        }
        const menu = document.getElementById("alertOverlay");
        if (!menu) {
            return;
        }
        const focusable = menu.querySelectorAll(
            'button:not([hidden]):not(.hidden), [href], [tabindex]:not([tabindex="-1"])'
        );
        const visible = [...focusable].filter((el) => el.offsetParent !== null);
        if (!visible.length) {
            return;
        }
        const first = visible[0];
        const last = visible[visible.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function wireControls() {
        const close = document.getElementById("alertClose");
        const back = document.getElementById("alertBack");
        if (close?.dataset.alertWired) {
            return;
        }
        if (close) {
            close.dataset.alertWired = "1";
            close.addEventListener("click", dismissAlertOverlay);
        }
        if (back) {
            back.dataset.alertWired = "1";
            back.addEventListener("click", () => {
                hideAlertDetail();
                document.getElementById("alertClose")?.focus();
            });
        }
    }

    return {
        init,
        resetForSearch,
        checkAlerts,
        syncOverlay: syncAlertOverlay,
        getStormLightningRank,
        openOverlay: openAlertOverlay,
    };
})();
