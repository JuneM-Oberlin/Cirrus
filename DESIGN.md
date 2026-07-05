# Cirrus — Design System

A design reference for the **Cirrus** weather app. Cirrus is a retro console–inspired
weather app: glossy plastic UI, a green "channel" header, big friendly numbers, and
playful-but-restrained motion. The frontend is **vanilla HTML/CSS/JS** (no framework,
no build step); the backend is Java (Spark).

Read this before changing any UI. The guiding rule: **authentic Console character** It should feel like a console developer made it — never like a toy.
---

## 1. North-star principles

1. ** Console authentic, but calm.** Glossy pills, gradients, gloss caps, friendly rounded type. But the resting state of the page is quiet. Don't add ambient motion to controls.
2. **Restraint over novelty.** Every effect earns its place. If deleting 30% of a flourish improves it, delete it. No sparkle sweeps, no rainbow gradients, no decorative blobs.
3. **Motion is `transform` / `opacity` / `box-shadow` only.** Never animate layout properties (width, height, top, left). Always gate behind `prefers-reduced-motion`.
4. **No infinite idle animation on interactive controls.** Buttons/inputs/chips rest static. Looping animation is allowed only on *decorative or status* elements (weather icon bob, sun sway, loading pulse, hint bounce).
5. **The green header is its own motif.** The TODAY / 5-DAY FORECAST channel tabs and the green city pill are deliberately their own thing. Don't restyle them to match other components.
6. **Keep the existing palette and tokens.** Add via the CSS variables; don't scatter new hardcoded hexes.

---

## 2. Files & load order

Loaded in this order from `public/index.html` (later files win in the cascade):

| File | Owns |
|------|------|
| `style.css` | Layout, color tokens, component **resting** visuals, glass panels |
| `animations.css` | All **motion** + interactive states (hover/active/focus transforms) |
| `weather-atmosphere.css` | Rain video / snow / lightning / fog / cloud overlays |
| `responsive.css` | Mobile overrides (`@media (max-width: 768px)`) |
| `script.js` | App logic, fetch, render, animation triggers |

**Convention that matters:** a component's *static look* lives in `style.css`; its
*hover/press/focus motion* lives in `animations.css`. Because `animations.css` loads
later, it wins conflicts on interactive states — so don't duplicate hover/active
`box-shadow` across both files.

---

## 3. Color

All theme colors are CSS variables in `:root` (`style.css`). The app has a **night**
(default) and **day** theme, toggled by adding `body.theme-day` (set in JS from the
weather's day/night code).

### Sky / background tokens
```
--sky-night:  linear-gradient #2258cc → #1640a8 → #0e2578 → #050f48 → #010820
--sky-day:    linear-gradient rgba(31,111,208) → … → rgba(191,230,255)  (opacity 0.92)
--sky-base-night: #010820     --sky-base-day: #3a92e4
--panel-tint-night: rgba(10,20,80,0.43)   --panel-tint-day: rgba(20,50,120,0.28)
--focus-ring-night: rgba(140,200,255,0.9) --focus-ring-day: rgba(255,255,255,0.95)
```
The night sky is painted with `body::before`, the day sky with `body::after`, cross-faded
over 1.2s when `theme-day` toggles. Never set a flat background color on `body`.

### Accent colors (semantic)
| Role | Color | Used for |
|------|-------|----------|
| Hero number | `#f0c000` (Wii yellow) | Current temp, forecast highs, sun times |
| Secondary number | `#00e5ff` (cyan) | Forecast lows |
| **Wii cyan rim** | `#36c3f2` border / `#4fd0fb` hover | Search input, Search button, history chips |
| Cyan halo | `rgba(54,195,242,0.30–0.60)` | The hairline/bloom ring on pills |
| Press glow | `#34beed` / `rgba(52,190,237,0.55–0.75)` | Search button `:active` halo — press only, never idle |
| Control label text | `#3a3a3a` (dark gray) | Text inside white pills |
| Channel green | `#1f7f15 → #155e0e` (bar), `#3ec832 → #1a7a12` (active tab) | Header only |
| City pill green | `#63f04d → #29bf1f → #159b10` | Header city pill |
| Error | `#ffaaaa` on `rgba(180,30,30,0.25)` | Error messages |
| Footer accent | `#8a1a3a → #5a0a22` (maroon) | Forecast footer — intentional, keep it |
| Muted label | `rgba(255,255,255,0.62)` | Detail/wind/sun labels (was 0.45; raised 2026-07-04 for contrast over the globe) |

Rule of thumb: **yellow = the number you care about most, cyan = the supporting number,
cyan rim = "this is a control you can touch," green = navigation chrome.**

---

## 4. Typography

- **Family:** `'M PLUS Rounded 1c'` (Google Fonts), fallback `Helvetica, Arial, sans-serif`.
  Weights loaded: 400, 700, 800. This rounded face *is* the brand — don't substitute a
  system stack.
- **Scale (desktop → mobile):**
  | Element | Size | Weight | Notes |
  |---------|------|--------|-------|
  | Current temp | 140px → 64px | 700 | `#f0c000`, `letter-spacing:-4px`, `tabular-nums`, stacked text-shadow |
  | Condition | 28px → 16px | 400 | white |
  | Forecast high | 60px | 700 | yellow, `tabular-nums` |
  | Forecast low | 44px | 700 | cyan |
  | Header tab | 18px → 12px | 700 | `letter-spacing:1.5px` |
  | Detail / wind / sun value | 16–20px | 600–700 | |
  | Detail / wind / sun label | **12px** (11px mobile) | normal | uppercase, `letter-spacing:1px`, muted |
- **Minimums (accessibility):** body text ≥ 16px, labels ≥ 12px. Don't go below.
- **Numbers:** always `font-variant-numeric: tabular-nums` on temps/times so digits don't jitter.
- The page `<h1>` is `visually-hidden` ("Cirrus Weather") — the green header acts as the
  visual title.

---

## 5. Spacing, layout & shape

- **Header height:** `--header-height` 52px desktop / 40px mobile. Header is `position:relative; z-index:10`, fixed at top.
- **Horizontal gutters:** content rows use `padding: … 80px` on desktop, `… 24px` on mobile.
- **Today card** (`.weather-card`): CSS grid, areas `summary / icon / details` then `aux`,
  `width: min(1220px, calc(100% - 48px))`, centered, `border-radius: 28px`.
- **Forecast strip:** 5 equal day cards desktop (`flex: 1 1 0`, `border-radius: 24px`,
  `min-height: 260px`); on mobile they collapse to stacked horizontal rows.
- **Background globe:** `.globe-bg` is a fixed NASA earth image at `opacity: 0.17`
  (0.32 mobile) behind everything — atmospheric, never competing with content.
- **Border-radius language:** pills `999px`; large cards `28px`; forecast cards `24px`;
  inner panels `18–20px`. Gloss caps use an *asymmetric* radius
  (`999px 999px 60% 60% / 999px 999px 22px 22px`) for the convex Wii dome.

### Glass panels
`.glass-panel` (+ `--card`, `--pill` variants) is the reusable translucent surface:
panel tint + a top gloss gradient driven by `--gloss` / `--gloss-stop`, a faint white
inset highlight, and a 1px translucent border. Use it for floating data surfaces (weather
card, forecast tiles, wind/sun bars), **not** for the cyan control pills.

---

## 6. The signature component: Wii cyan pill

The Search input, Search button, and history chips form **one pill family**.

**Recipe (resting, in `style.css`):**
```css
position: relative; isolation: isolate; overflow: hidden;  /* contains the gloss cap */
border-radius: 999px;
border: 1.5px solid #36c3f2;                                /* cyan rim */
background: linear-gradient(180deg, #fdffff 0%, #eef4f7 50%, #d6e2e9 100%); /* white→silver */
color: #3a3a3a;                                             /* dark etched label */
text-shadow: 0 1px 0 rgba(255,255,255,0.85);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.95),     /* top sheen */
  inset 0 -2px 3px rgba(54,195,242,0.25),   /* cyan underbelly */
  0 0 0 1px rgba(54,195,242,0.35),          /* hairline cyan halo */
  0 3px 9px rgba(0,0,0,0.32);               /* soft drop shadow */
```

**The gloss cap** is a static `::before` covering the top ~42%, white→transparent,
with `z-index: -1` so it sits above the silver fill but below the label. The parent's
`isolation: isolate` contains the negative-z child. (Do **not** use `z-index: 0` — at
equal z-index a positioned pseudo paints over the text and hides the label.)

**Touch target:** chips keep `min-height: 44px`. Never shrink below 44px.

---

## 7. Motion

Easing tokens (`animations.css`):
```
--nintendo-spring: cubic-bezier(0.34, 1.56, 0.64, 1)   /* overshoot — entrances, presses */
--nintendo-soft:   cubic-bezier(0.32, 0.72, 0, 1)      /* smooth — hovers, fades */
--nintendo-press:  cubic-bezier(0.25, 0.46, 0.45, 0.94)/* quick — gloss-cap catch */
```

Reusable keyframes already defined: `nintendoPop`, `nintendoBounce`, `nintendoWiggle`,
`iconBob`, `sunRock`, `loadingBounce`, `hintBounce`, `tempPop`, `citySlideIn`,
`detailStagger`, `wiiSquashPress`, `tempFreezeIn`, `tempShiver`, `tempHeatShake`.
**Reuse these before inventing new ones.** (`wiiSelectPulse` was removed 2026-07-04 —
the Search button no longer pulses on focus; see the press glow below.)

### Today ⇄ Forecast window swipe (script.js, Web Animations API)
Both tab panels live side-by-side in a 200%-wide `.view-track` inside an
`overflow: clip` viewport. Switching tabs slides the track 500ms with
`--nintendo-soft`. Day cards pop in left→right (540ms, 150ms stagger, spring)
once the swipe lands, and pop out rightmost-first (380ms, ease-in accelerate)
*before* the swipe back, where the big temp squash-lands (`tempPop`). All
sequenced from `switchTab()` in script.js via `element.animate()`.

### Temperature moods (`#tempMain`)
- **Below 32°F:** `.temp--freezing` — number starts yellow, `tempFreezeIn`
  fades it to the low-temp cyan over 1.6s, then `tempShiver` trembles ±1px.
- **95°F and up:** `.temp--hot` — `tempHeatShake` jitters with amplitude
  0.3→1px and period 0.5→0.35s scaling until 120°F (JS sets `--heat-amp` /
  `--heat-speed`).
These are *status displays*, not controls — they're the sanctioned exception
to the no-idle-loop rule, alongside the icon bob / sun sway / hint bounce.

### Interaction patterns
| Trigger | Effect |
|---------|--------|
| Hover (pill) | lift `translateY(-2px) scale(1.03)` + cyan rim bloom (brighter ring, `border-color → #4fd0fb`). One ring only — no sparkle/shine sweep. |
| Press (pill) | `wiiSquashPress` squash-and-stretch (non-uniform `scale(x,y)`), one-shot. Gloss cap does a `scaleY(0.72)` light-catch. |
| Press (Search button) | adds a static two-layer **blue glow** (`#34beed`) to the `:active` box-shadow — appears only while pressed, fades with the box-shadow transition. Never idle, never pulsing. |
| Keyboard focus | standard 3px `--focus-ring` outline only — no pulse. (The old `wiiSelectPulse` breathing halo was removed 2026-07-04.) |
| List render | staggered pop-in via `nintendoPop` + an `nth-child` delay ladder (chips, forecast days, detail stats). Class added by JS, removed on `animationend`. |
| Channel tab | hover lift + active press, spring easing. |

### Idle/looping motion — allowed ONLY here
`weather-img` (iconBob), `sun-icon` (sunRock), `#loading` (loadingBounce),
`forecast-hint` (hintBounce), `#tempMain` temperature moods (tempShiver /
tempHeatShake — status display, see above). **Never** add a loop to a button,
input, chip, or the card.

### Reduced motion
`animations.css` ends with a `prefers-reduced-motion: reduce` block that neutralizes
durations, kills the focus pulse / squash / stagger, and pins gloss caps to their static
state. Any new animation **must** be added to that block. The static pill look must render
identically with motion off.

---

## 8. Theming (day / night)

JS adds/removes `body.theme-day` based on whether the weather code ends in `n` (night).
This swaps `--sky-base`, `--panel-tint`, and `--focus-ring` to their day/night values and
cross-fades the two sky layers. There's also a weather-atmosphere layer
(`weather-atmosphere.css` + `atmo-*.js`) that overlays rain video, snow, lightning, fog,
and clouds based on conditions. Keep these effects subtle and behind the UI
(`pointer-events: none`).

---

## 9. Responsive

Single width breakpoint: **768px**. On mobile:
- Header shrinks to 40px; gutters drop from 80px to 24px.
- Search row stacks vertically; input and button go full-width.
- Forecast cards collapse from 5 columns into stacked horizontal rows.
- Detail stats sit in a 2-column grid (three rows of two).
- Type scales down (temp 140→64px, etc.) but never below the 16px body / 12px label floors.
- Globe opacity rises slightly (0.17 → 0.32) since there's less content.

One height query: **`(min-width: 769px) and (max-height: 800px)`** compacts the
forecast day cards and details panel so strip + details + footer fit a ~720p
window without scrolling.

Test every UI change at 375px (mobile), 768px (tablet), and ≥1280px (desktop).

---

## 10. Accessibility (non-negotiable)

- **ARIA:** tabs use `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, `aria-controls`;
  search input has an `aria-label`; loading/error use `aria-live` / `role="alert"`.
- **Focus:** every interactive element gets a 3px `focus-visible` ring (`--focus-ring`).
  Never `outline: none` without a visible replacement.
- **Touch targets** ≥ 44px. **Body text** ≥ 16px. **Labels** ≥ 12px. **Contrast** ≥ 4.5:1
  on body text.
- **Motion** always respects `prefers-reduced-motion`.
- Keep the `visually-hidden` h1 and any visually-hidden labels.

---

## 11. Don'ts (design guardrails)

- No purple/violet/indigo gradients or blue-to-purple schemes.
- No 3-column "icon-in-a-colored-circle" feature grids.
- No `text-align: center` on everything.
- No decorative blobs, floating circles, or wavy dividers.
- No emoji as UI decoration.
- No generic system-ui/`-apple-system` as the display font — the rounded face is the brand.
- No infinite glow/pulse/sparkle on buttons or inputs.
- Don't restyle the green channel header to match other components.

---

## 12. Quick checklist before shipping a UI change

- [ ] Resting state static; motion only on hover/press/focus (or an allowed decorative loop)
- [ ] Animations use `transform`/`opacity`/`box-shadow` and a `--nintendo-*` easing
- [ ] New animation added to the `prefers-reduced-motion` block
- [ ] Colors come from tokens / the documented palette (yellow hero, cyan secondary, cyan rim controls)
- [ ] Font is M PLUS Rounded 1c; labels ≥12px, body ≥16px, numbers tabular
- [ ] Touch targets ≥44px; focus ring present
- [ ] Checked at 375 / 768 / 1280px
- [ ] Green header untouched; maroon footer kept
