/* Cirrus feel settings: the timings and amounts only JavaScript uses.
   Colors, CSS timings, and spring curves live in theme.css; everything
   the scripts need to know about motion lives here, in one place. */

const CirrusConfig = Object.freeze({
    // Big numbers roll up from zero when a view opens.
    countUp: {
        durationMs: 600,
    },

    // A view slides in, runs a few pixels past its spot, and settles back.
    // The overshoot is a fixed size, so a long jump from the dots doesn't fling.
    viewSlide: {
        overshootPx: 18,
        overshootAt: 0.68,
    },

    // The title, button labels, and wind line come in with the view.
    chrome: {
        titleShiftPercent: 70,
        labelFromScale: 0.7,
        windShiftPx: 32,
        windDelayMs: 90,
    },

    // Screens pop in from slightly small, or zoom out of what you clicked.
    screens: {
        popFromScale: 0.94,
        leaveToScale: 0.96,
        zoomMinScale: 0.15,
    },

    // After a drag the globe keeps spinning and slows down each frame.
    globeGlide: {
        frictionPerFrame: 0.94,
        stopBelowDegPerMs: 0.003,
        maxDegPerMs: 0.5,
    },
});
