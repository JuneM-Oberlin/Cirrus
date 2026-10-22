/* Cirrus sounds, all made on the spot from plain tones with the Web Audio
   API; nothing here is a recording. A light tick on hover, a rounder pop
   on press, a two-note chime when a view opens, a lower blip for Back, a
   soft two-tone for weather warnings, and an optional calm music loop.

   Browsers only allow sound after the person has clicked, tapped, or
   pressed a key, so nothing plays (and no audio is even set up) until
   then. The effects and music switches are remembered on this device. */

const CirrusSound = (function () {
    const STORAGE_KEY = "cirrus_sound";

    // "on" / "off" strings, like the Settings buttons use
    let settings = { effects: "on", music: "off" };
    const listeners = [];

    let context = null;   // the AudioContext, made on the first interaction
    let effectsOut = null; // every effect plays through this volume knob
    let lastHoverAt = 0;
    let music = null;      // the music loop while it is playing
    // a warning that arrived before sound was allowed plays on the first click
    let alertWaiting = false;

    function config() {
        return CirrusConfig.sound;
    }

    /* ---------- Remembered switches ---------- */

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }
            const saved = JSON.parse(raw);
            if (saved.effects === "on" || saved.effects === "off") {
                settings.effects = saved.effects;
            }
            if (saved.music === "on" || saved.music === "off") {
                settings.music = saved.music;
            }
        } catch (err) {
            console.log("Could not load sound settings:", err);
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (err) {
            console.log("Could not save sound settings:", err);
        }
    }

    function getSettings() {
        return Object.assign({}, settings);
    }

    function onChange(listener) {
        listeners.push(listener);
    }

    // change: { effects: "on" | "off" } and/or { music: "on" | "off" }
    function update(change) {
        const turnedEffectsOn = change.effects === "on" && settings.effects === "off";
        settings = Object.assign({}, settings, change);
        save();
        if (settings.music === "on") {
            startMusic();
        } else {
            stopMusic();
        }
        // a little pop says "sound is back on"
        if (turnedEffectsOn) {
            play("pop");
        }
        listeners.forEach((listener) => listener(getSettings()));
    }

    /* ---------- Waking the audio up on the first interaction ---------- */

    function unlock() {
        if (context) {
            return;
        }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            return;
        }
        context = new AudioContextClass();
        effectsOut = context.createGain();
        effectsOut.gain.value = config().effectsVolume;
        effectsOut.connect(context.destination);
        if (context.state === "suspended") {
            context.resume();
        }
        if (settings.music === "on") {
            startMusic();
        }
        if (alertWaiting) {
            alertWaiting = false;
            play("alert", { delayMs: config().waitingAlertDelayMs });
        }
    }

    /* ---------- Effects ---------- */

    // One soft note: a tone that fades in over a few milliseconds and away
    // again, optionally sliding in pitch. note: { freq, toFreq, wave, at, ms, volume }
    function playNote(note, startAt, output) {
        const begin = startAt + note.at / 1000;
        const end = begin + note.ms / 1000;
        const tone = context.createOscillator();
        const envelope = context.createGain();
        tone.type = note.wave;
        tone.frequency.setValueAtTime(note.freq, begin);
        if (note.toFreq) {
            tone.frequency.exponentialRampToValueAtTime(note.toFreq, end);
        }
        envelope.gain.setValueAtTime(0.0001, begin);
        envelope.gain.exponentialRampToValueAtTime(note.volume, begin + config().attackMs / 1000);
        envelope.gain.exponentialRampToValueAtTime(0.0001, end);
        tone.connect(envelope);
        envelope.connect(output);
        tone.start(begin);
        tone.stop(end + 0.05);
    }

    // name is one of the sounds in feel-config.js (tick, pop, chime, back, alert, ...)
    function play(name, { delayMs = 0 } = {}) {
        if (!context && name === "alert") {
            alertWaiting = true;
            return;
        }
        if (!context || settings.effects !== "on") {
            return;
        }
        const notes = config()[name];
        if (!notes) {
            return;
        }
        const startAt = context.currentTime + delayMs / 1000;
        notes.forEach((note) => playNote(note, startAt, effectsOut));
    }

    // Hover ticks are spaced out so sweeping across a row doesn't chatter.
    function hover() {
        const now = Date.now();
        if (now - lastHoverAt < config().hoverGapMs) {
            return;
        }
        lastHoverAt = now;
        play("tick");
    }

    /* ---------- Music: a slow, soft chord loop with a few bell notes ---------- */

    function padNote(freq, at, seconds) {
        const tune = config().music;
        const fadeIn = tune.padAttackSeconds;
        const fadeOut = tune.padReleaseSeconds;
        // two tones a hair apart in pitch make the pad shimmer gently
        tune.padDetuneCents.forEach((cents) => {
            const tone = context.createOscillator();
            const envelope = context.createGain();
            tone.type = tune.padWave;
            tone.frequency.value = freq;
            tone.detune.value = cents;
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(tune.padVolume, at + fadeIn);
            envelope.gain.setValueAtTime(tune.padVolume, at + seconds);
            envelope.gain.linearRampToValueAtTime(0, at + seconds + fadeOut);
            tone.connect(envelope);
            envelope.connect(music.filter);
            tone.start(at);
            tone.stop(at + seconds + fadeOut + 0.1);
        });
    }

    // Queues chords a couple of seconds ahead, one chord at a time.
    function scheduleMusic() {
        const tune = config().music;
        while (music && music.nextAt < context.currentTime + tune.lookAheadSeconds) {
            const chord = tune.chords[music.chordIndex % tune.chords.length];
            chord.forEach((freq) => padNote(freq, music.nextAt, tune.chordSeconds));
            // a few bell notes from the chord, two octaves up
            for (let i = 0; i < tune.bellsPerChord; i += 1) {
                const freq = chord[(i * 2 + music.chordIndex) % chord.length] * 4;
                const at = music.nextAt + (i + 0.5) * tune.chordSeconds / tune.bellsPerChord;
                playNote({ freq, wave: "sine", at: 0, ms: tune.bellSeconds * 1000, volume: tune.bellVolume }, at, music.filter);
            }
            music.nextAt += tune.chordSeconds;
            music.chordIndex += 1;
        }
    }

    function startMusic() {
        if (music || !context || settings.music !== "on" || document.visibilityState === "hidden") {
            return;
        }
        const tune = config().music;
        const volume = context.createGain();
        volume.gain.setValueAtTime(0, context.currentTime);
        volume.gain.linearRampToValueAtTime(tune.volume, context.currentTime + tune.fadeSeconds);
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = tune.filterHz;
        // a soft echo for a sense of space
        const echo = context.createDelay();
        echo.delayTime.value = tune.echoSeconds;
        const feedback = context.createGain();
        feedback.gain.value = tune.echoFeedback;
        filter.connect(volume);
        filter.connect(echo);
        echo.connect(feedback);
        feedback.connect(echo);
        echo.connect(volume);
        volume.connect(context.destination);

        music = { volume, filter, chordIndex: 0, nextAt: context.currentTime + 0.1, timer: null };
        scheduleMusic();
        music.timer = setInterval(scheduleMusic, tune.scheduleEveryMs);
    }

    function stopMusic() {
        if (!music) {
            return;
        }
        const playing = music;
        music = null;
        clearInterval(playing.timer);
        const fade = config().music.fadeSeconds;
        playing.volume.gain.cancelScheduledValues(context.currentTime);
        playing.volume.gain.setValueAtTime(playing.volume.gain.value, context.currentTime);
        playing.volume.gain.linearRampToValueAtTime(0, context.currentTime + fade);
        setTimeout(() => playing.volume.disconnect(), fade * 1000 + 100);
    }

    function init() {
        load();
        // capture phase, so the very first press can already make its pop
        ["pointerdown", "keydown", "touchend"].forEach((type) => {
            document.addEventListener(type, unlock, { capture: true });
        });
        // music rests while the tab is hidden
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                stopMusic();
            } else {
                startMusic();
            }
        });
    }

    return { init, play, hover, getSettings, update, onChange };
})();
