/* City search lives in the lime location pill: tap it and the pill turns
   into a text field while the panel lists recent cities. As you type a
   town's name, the places that match appear above them ("Which one?"), so
   "Canton" can mean Canton, Ohio rather than the first Canton the weather
   service thinks of. Typing a US state ("Canton OH") goes straight there. */

const CirrusSearch = (function () {
    let deps = {
        frame: null,
        onSearch: () => {},
        getRecents: () => [],
        // resolves to the matching places, or null when place search isn't available
        findPlaces: async () => null,
    };
    let suggestTimer = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function isOpen() {
        return deps.frame.screenName() === "search";
    }

    function showField() {
        byId("locationPill").classList.add("hidden");
        byId("searchForm").classList.remove("hidden");
    }

    function hideField() {
        byId("searchForm").classList.add("hidden");
        byId("locationPill").classList.remove("hidden");
        byId("cityInput").blur();
    }

    function renderRecents() {
        const list = byId("recentList");
        const recents = deps.getRecents();
        list.replaceChildren();
        recents.forEach((city) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip-btn";
            button.textContent = CirrusPlaces.labelOf(city);
            button.addEventListener("click", () => deps.onSearch(city));
            item.appendChild(button);
            list.appendChild(item);
        });
        byId("recentHeading").classList.toggle("hidden", recents.length === 0);
    }

    /* ---------- Matching places ---------- */

    function clearPlaces() {
        clearTimeout(suggestTimer);
        byId("placeList").replaceChildren();
        byId("placeList").classList.add("hidden");
        byId("placeHeading").classList.add("hidden");
        byId("placeStatus").textContent = "";
    }

    // Lists the places matching text as buttons; picking one loads exactly that place.
    function showPlaces(text, places) {
        const list = byId("placeList");
        list.replaceChildren();
        places.forEach((place) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "chip-btn";
            button.textContent = CirrusPlaces.describe(place, places);
            button.addEventListener("click", () => deps.onSearch(CirrusPlaces.fromPlace(place, places)));
            item.appendChild(button);
            list.appendChild(item);
        });
        byId("placeHeading").textContent = "Which " + text + "?";
        byId("placeHeading").classList.remove("hidden");
        list.classList.remove("hidden");
        let count = places.length + " matches";
        if (places.length === 1) {
            count = "1 match";
        }
        byId("placeStatus").textContent = count + " for " + text + ".";
    }

    // Typed text that already says where (a comma, or a US state) needs no list.
    function saysWhere(text) {
        return text.includes(",") || CirrusPlaces.tidy(text) !== text.trim().replace(/\s+/g, " ");
    }

    // While typing: once the typing pauses, show what matches.
    function suggest() {
        clearTimeout(suggestTimer);
        const text = byId("cityInput").value.trim();
        if (text.length < CirrusConfig.search.suggestMinChars || saysWhere(text)) {
            clearPlaces();
            return;
        }
        suggestTimer = setTimeout(async () => {
            const places = await deps.findPlaces(text);
            // the field may have changed while the matches were on their way
            if (byId("cityInput").value.trim() !== text) {
                return;
            }
            if (places && places.length > 0) {
                showPlaces(text, places);
            } else {
                clearPlaces();
            }
        }, CirrusConfig.search.suggestDelayMs);
    }

    // What to load for typed text: { query } when it is clear which place is
    // meant, or { places } when there are several to choose from. Without
    // place search (an older server, or no matches) the text is searched as typed.
    async function resolve(text) {
        const typed = text.trim();
        if (saysWhere(typed)) {
            return { query: CirrusPlaces.tidy(typed) };
        }
        const places = await deps.findPlaces(typed);
        if (!places || places.length === 0) {
            return { query: typed };
        }
        if (places.length === 1) {
            return { query: CirrusPlaces.fromPlace(places[0], places) };
        }
        return { places };
    }

    async function submit(text) {
        const result = await resolve(text);
        if (result.query) {
            deps.onSearch(result.query);
            return;
        }
        showPlaces(text.trim(), result.places);
        // the first match is one Tab away from the field
        const first = byId("placeList").querySelector("button");
        if (first) {
            first.focus();
        }
    }

    // text fills the field (a search started from the desktop Home box)
    function open(text = "") {
        if (!isOpen()) {
            deps.frame.openScreen("search", { title: "Location", onClose: hideField });
        }
        showField();
        clearPlaces();
        renderRecents();
        const input = byId("cityInput");
        input.value = text;
        input.focus();
    }

    // After a failed search: back in the field with the old text selected,
    // so typing replaces it.
    function retype() {
        if (!isOpen()) {
            open();
            return;
        }
        const input = byId("cityInput");
        input.focus();
        if (input.select) {
            input.select();
        }
    }

    function close() {
        if (isOpen()) {
            deps.frame.closeScreen();
        }
    }

    // A new city's name slides into the pill from the right.
    function setLocation(name) {
        const label = byId("locationName");
        const changed = label.textContent !== name;
        label.textContent = name;
        byId("locationPill").setAttribute("aria-label", "Location: " + name + ". Change city");
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (changed && !calm && label.animate) {
            label.animate([
                { opacity: 0, transform: "translateX(" + CirrusConfig.chrome.windShiftPx + "px)" },
                { opacity: 1, transform: "none" },
            ], {
                duration: deps.frame.cssDuration("--dur-spring-pop"),
                easing: getComputedStyle(document.documentElement).getPropertyValue("--spring-pop").trim(),
            });
        }
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        byId("locationPill").addEventListener("click", () => open());
        byId("searchForm").addEventListener("submit", (event) => {
            event.preventDefault();
            clearTimeout(suggestTimer);
            const city = byId("cityInput").value.trim();
            if (city) {
                submit(city);
            }
        });
        byId("cityInput").addEventListener("input", suggest);
        const emptyChoose = byId("emptyChoose");
        if (emptyChoose) {
            emptyChoose.addEventListener("click", () => open());
        }
    }

    return {
        init,
        open,
        retype,
        close,
        isOpen,
        setLocation,
        renderRecents,
        resolve,
        showPlaces,
    };
})();
