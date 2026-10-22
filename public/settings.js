/* Settings screen: temperature (°F / °C) and wind (mph / km/h) choices.
   Each pair is a radio group; choices save immediately and every view
   re-renders in the new units. */

const CirrusSettings = (function () {
    let deps = { frame: null, units: null };

    function choices() {
        return [...document.querySelectorAll(".settings-choice")];
    }

    function render() {
        const settings = deps.units.getSettings();
        choices().forEach((button) => {
            const selected = settings[button.dataset.setting] === button.dataset.value;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-checked", String(selected));
            // roving tabindex: Tab reaches only the chosen option in each group
            if (selected) {
                button.tabIndex = 0;
            } else {
                button.tabIndex = -1;
            }
        });
    }

    function choose(button) {
        const change = {};
        change[button.dataset.setting] = button.dataset.value;
        deps.units.update(change);
        render();
    }

    // Arrow keys move between the two options of a group, like radios.
    function onKeydown(event, button) {
        const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
        if (!keys.includes(event.key)) {
            return;
        }
        event.preventDefault();
        const group = choices().filter((other) => other.dataset.setting === button.dataset.setting);
        const index = group.indexOf(button);
        let next = index + 1;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            next = index - 1;
        }
        next = (next + group.length) % group.length;
        choose(group[next]);
        group[next].focus();
    }

    function open() {
        render();
        deps.frame.openScreen("settings", { title: "Settings" });
        const selected = choices().find((button) => button.classList.contains("is-selected"));
        if (selected) {
            selected.focus();
        }
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        choices().forEach((button) => {
            button.addEventListener("click", () => choose(button));
            button.addEventListener("keydown", (event) => onKeydown(event, button));
        });
        render();
        deps.frame.setHandlers({ onSettings: open });
    }

    return { init, open };
})();
