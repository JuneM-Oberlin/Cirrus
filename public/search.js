/* City search lives in the lime location pill: tap it and the pill turns
   into a text field while the panel lists recent cities. */

const CirrusSearch = (function () {
    let deps = {
        frame: null,
        onSearch: () => {},
        getRecents: () => [],
    };

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
            button.textContent = city;
            button.addEventListener("click", () => deps.onSearch(city));
            item.appendChild(button);
            list.appendChild(item);
        });
        byId("recentHeading").classList.toggle("hidden", recents.length === 0);
    }

    function open() {
        if (!isOpen()) {
            deps.frame.openScreen("search", { title: "Location", onClose: hideField });
        }
        showField();
        renderRecents();
        const input = byId("cityInput");
        input.value = "";
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

    function setLocation(name) {
        byId("locationName").textContent = name;
        byId("locationPill").setAttribute("aria-label", "Location: " + name + ". Change city");
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        byId("locationPill").addEventListener("click", open);
        byId("searchForm").addEventListener("submit", (event) => {
            event.preventDefault();
            const city = byId("cityInput").value.trim();
            if (city) {
                deps.onSearch(city);
            }
        });
        const emptyChoose = byId("emptyChoose");
        if (emptyChoose) {
            emptyChoose.addEventListener("click", open);
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
    };
})();
