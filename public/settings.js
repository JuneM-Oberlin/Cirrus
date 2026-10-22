/* Settings screen: units (°F / °C, mph / km/h) and sound (effects and
   music on or off). Each pair is a radio group; choices save immediately.
   New units re-render every view; the sound switches go to sound.js. */

const CirrusSettings = (function () {
    let deps = { frame: null, units: null, sound: null };

    function choices() {
        return [...document.querySelectorAll(".settings-choice")];
    }

    // Which module keeps a setting: the sound engine for effects and music,
    // the units for everything else.
    function storeFor(setting) {
        if (deps.sound && setting in deps.sound.getSettings()) {
            return deps.sound;
        }
        return deps.units;
    }

    function render() {
        choices().forEach((button) => {
            const settings = storeFor(button.dataset.setting).getSettings();
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
        storeFor(button.dataset.setting).update(change);
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
