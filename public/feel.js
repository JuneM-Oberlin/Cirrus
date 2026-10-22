/* Tactile buttons. Every button squashes down and bounces back when it is
   pressed, and the full squash plays even on a very quick click (a plain
   CSS :active animation stops the moment you let go). Glossy buttons also
   get a shine layer the first time you point at them; CSS sweeps it across
   on hover. Pointing at a button ticks, pressing one pops (Back buttons
   leave their sound to the frame), and phones get a tiny buzz. */

const CirrusFeel = (function () {
    const PRESSABLE = "button";
    const SHINY = [
        ".frame-btn",
        ".frame-location",
        ".frame-search-go",
        ".chip-btn",
        ".fiveday-col",
        ".alert-bar",
        ".home-badge",
        ".channel-tile--live",
        ".channel-search button",
        ".channel-tray-button",
    ].join(", ");

    let deps = {
        sound: { play() {}, hover() {} },
        vibrate: (ms) => {
            if (navigator.vibrate) {
                navigator.vibrate(ms);
            }
        },
        hapticMs: 8,
    };
    // the button the mouse is over, so moving across its label doesn't tick again
    let hovered = null;

    function reducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function closestFrom(event, selector) {
        if (!event.target || !event.target.closest) {
            return null;
        }
        return event.target.closest(selector);
    }

    function addShine(button) {
        for (const child of button.children) {
            if (child.classList.contains("shine")) {
                return;
            }
        }
        const shine = document.createElement("span");
        shine.classList.add("shine");
        shine.setAttribute("aria-hidden", "true");
        button.appendChild(shine);
    }

    // Starts the squash over again, even if the last one is still playing.
    function squash(button) {
        if (button.disabled || reducedMotion()) {
            return;
        }
        button.classList.remove("is-squashing");
        // Reading the width makes the browser notice the class came off,
        // so adding it back restarts the animation.
        void button.offsetWidth;
        button.classList.add("is-squashing");
    }

    function onAnimationEnd(event) {
        if (event.animationName !== "wiiSquashPress") {
            return;
        }
        const button = closestFrom(event, ".is-squashing");
        if (button) {
            button.classList.remove("is-squashing");
        }
    }

    function onHover(event) {
        const shiny = closestFrom(event, SHINY);
        if (shiny) {
            addShine(shiny);
        }
        const button = closestFrom(event, PRESSABLE);
        if (button === hovered) {
            return;
        }
        hovered = button;
        if (button && !button.disabled && event.pointerType === "mouse") {
            deps.sound.hover();
        }
    }

    function press(button, pointerType) {
        if (button.disabled) {
            return;
        }
        squash(button);
        if (button.dataset.sound !== "back") {
            deps.sound.play("pop");
        }
        if (pointerType === "touch") {
            deps.vibrate(deps.hapticMs);
        }
    }

    // dependencies: { sound, vibrate, hapticMs }, all optional
    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        document.addEventListener("pointerover", onHover);
        document.addEventListener("pointerdown", (event) => {
            const button = closestFrom(event, PRESSABLE);
            if (button) {
                press(button, event.pointerType);
            }
        });
        // Enter and Space press buttons from the keyboard, so they squash too.
        document.addEventListener("keydown", (event) => {
            if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
                return;
            }
            const button = closestFrom(event, PRESSABLE);
            if (button) {
                press(button, "keyboard");
            }
        });
        document.addEventListener("animationend", onAnimationEnd);
    }

    return { init, squash };
})();
