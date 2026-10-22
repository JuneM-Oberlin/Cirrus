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

    // The drawn hand: how far it leans while moving and how it hops.
    pointer: {
        leanPerSpeed: 10,
        maxLeanDeg: 12,
        leanFollow: 0.25,
        leanSettle: 0.82,
        bounceScale: 1.22,
        bounceMs: 380,
        // the ripple under a finger on touch screens
        ripple: {
            fromScale: 0.2,
            startOpacity: 0.6,
            durationMs: 480,
            fadeMs: 220,
        },
    },

    // A tiny buzz on press, on phones that support vibration.
    haptics: {
        pressMs: 8,
    },

    // Every sound is built from plain tones (sound.js). A note is
    // { freq, toFreq (optional slide), wave, at (ms after start), ms, volume }.
    sound: {
        effectsVolume: 0.8,
        attackMs: 4,
        hoverGapMs: 70,
        chimeDelayMs: 120,
        // a warning that came in before the first click sounds just after it
        waitingAlertDelayMs: 450,
        tick: [
            { freq: 2600, toFreq: 2200, wave: "sine", at: 0, ms: 30, volume: 0.035 },
        ],
        pop: [
            { freq: 540, toFreq: 300, wave: "sine", at: 0, ms: 95, volume: 0.13 },
            { freq: 1080, toFreq: 620, wave: "triangle", at: 0, ms: 60, volume: 0.025 },
        ],
        // rising fifth, C6 to G6
        chime: [
            { freq: 1046.5, wave: "sine", at: 0, ms: 260, volume: 0.05 },
            { freq: 1568, wave: "sine", at: 90, ms: 340, volume: 0.045 },
        ],
        back: [
            { freq: 420, toFreq: 250, wave: "sine", at: 0, ms: 130, volume: 0.11 },
        ],
        // a gentle falling two-tone, played twice
        alert: [
            { freq: 880, wave: "triangle", at: 0, ms: 200, volume: 0.07 },
            { freq: 659.3, wave: "triangle", at: 220, ms: 260, volume: 0.07 },
            { freq: 880, wave: "triangle", at: 700, ms: 200, volume: 0.06 },
            { freq: 659.3, wave: "triangle", at: 920, ms: 300, volume: 0.06 },
        ],
        // the optional music: four slow chords (F, Dm, Bb, C, all with
        // added notes) under a few soft bells, eight seconds per chord
        music: {
            volume: 0.5,
            fadeSeconds: 1.5,
            chordSeconds: 8,
            lookAheadSeconds: 2,
            scheduleEveryMs: 1000,
            chords: [
                [174.6, 220, 261.6, 329.6],
                [146.8, 174.6, 220, 261.6],
                [116.5, 146.8, 174.6, 220],
                [130.8, 164.8, 196, 261.6],
            ],
            padWave: "triangle",
            padVolume: 0.03,
            padDetuneCents: [-4, 4],
            padAttackSeconds: 2.5,
            padReleaseSeconds: 3,
            filterHz: 900,
            bellsPerChord: 3,
            bellVolume: 0.03,
            bellSeconds: 2.2,
            echoSeconds: 0.38,
            echoFeedback: 0.32,
        },
    },
});
