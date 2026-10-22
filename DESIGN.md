# Cirrus — Design System

A design reference for the **Cirrus** weather app. Cirrus is styled after a retro
console weather channel: silver button rows, a green title block with a lime location
pill, a royal-blue panel over satellite imagery, and big friendly numbers. The frontend
is **vanilla HTML/CSS/JS** (no framework, no build step); the backend is Java (Spark).

Read this before changing any UI. The guiding rule: **authentic console character.** It
should feel like a console developer made it, never like a toy, and never like a copy.
All artwork, icons, and the cursor are original.

---

## 1. North-star principles

1. **Console-authentic, but calm.** Glossy faces, gradients, friendly rounded type. The resting page is quiet; don't add ambient motion to controls.
2. **Restraint over novelty.** Every effect earns its place. If deleting 30% of a flourish improves it, delete it.
3. **Motion is `transform` / `opacity` / `box-shadow` only.** Never animate layout properties. Always gate motion behind `prefers-reduced-motion`.
4. **No idle animation on controls.** Buttons, pills, and inputs rest static. Loops are allowed only on decorative or status elements (icon bob, temperature moods, Home hints).
5. **The frame is the motif.** Button rows, title block, lime pill, blue panel, wind band, and red "As of" strip appear on every view in the same places. New features fit into the frame; they don't add new chrome.
6. **Every design value is a token.** Colors, gradients, shadows, radii, spacing, font sizes, durations, and easings live in `theme.css`. A test fails if one appears anywhere else.

---

## 2. Files & load order

Loaded in this order from `public/index.html`:

| File | Owns |
|------|------|
| `theme.css` | **All** design tokens as custom properties on `:root`, plus mobile overrides in `@media (max-width: 767px)` |
| `base.css` | Reset, fonts, page sky, cursor, focus ring, `.hidden` / `.visually-hidden` |
| `frame.css` | Button rows, header, panel, footer, view stack, the six views, screens (search, settings, day detail) |
| `channels.css` | Desktop Home menu (tiles, letterbox search, tray) |
| `alerts.css` | Alert bar, red/orange header variants, alert screen |
| `globe.css` | Globe screen, canvas, markers, globe-mode button rows |
| `weather-atmosphere.css` | Rain video / snow / fog / lightning overlays inside the panel |
| `motion.css` | Every keyframe, hover/press motion, and the reduced-motion block |

**Conventions:**

- A component's *static look* lives in its component file. Its *motion* (keyframes, hover lifts, press squash) lives in `motion.css`.
- A new value goes into `theme.css` first, then gets used through `var(--…)`.
- Mobile differences are token overrides in `theme.css` wherever possible. Only layout changes (grid areas, stacking) belong in a component file's `@media` block.

**Token lint** (`test/theme-tokens.test.js`) fails on any hex/rgb/hsl color, px/em/rem/vh/vw length, ms/s duration, or `cubic-bezier` outside `theme.css` (comments and `@media` lines excepted). A second test fails if a stylesheet uses a token that `theme.css` doesn't define. The only properties set at runtime are `--view-index`, `--heat-amp`, `--heat-speed`, and `--channel-globe-image`.

---

## 3. The frame

```
┌ clock ───────┬──── ▲ Previous view ────┬──── Settings ┐   top row     --frame-row-height
├ TITLE BLOCK ─┴─( lime location pill  )─────────────────┤   header      --frame-header-height
│ [alert bar, when NWS alerts are active]                │
│                                                        │
│   royal-blue panel over NASA satellite imagery         │   panel
│   one view at a time, sliding vertically               │
│                                                        │
│ credit                         wind band  ▸ big wind   │
│                                "As of" red-pink strip  │
├ Back / Home ─┬──── ▼ Next view ────────┬──── Globe ────┤   bottom row
└──────────────┴─────────────────────────┴───────────────┘
```

- **Button rows** are three silver faces (`--frame-btn-face`). The middle buttons step through the view stack and are labeled with the neighbor's name. A slot with nothing to do is disabled and drawn blank (`.is-empty`). The middle buttons light up cyan (`--frame-btn-face-active`) on hover. Corner buttons brighten on hover and turn cyan while pressed. Keyboard focus draws `--focus-ring-on-light` inside the button.
- **Corners:** clock top-left (DSEG7 digits, `--font-digital`), Settings top-right, Back/Home bottom-left, Globe bottom-right. On the globe the rows become Zoom − / Next / Zoom + and End / ↶ ↷ / Restore.
- **Header:** the green title block (`--title-block`) names the view; long names drop to `--title-font-long`. The lime pill (`--pill-face`) names the city and opens the Location screen.
- **Panel:** `--panel-face` plus `--panel-streaks` over a GIBS satellite image of the city at `--panel-sat-opacity`. The footer always carries the credit (bottom-left), the wind band, and the "As of" strip (bottom-right).
- **View stack:** UV Index → Current → Today → Tomorrow → 5-Day → 6-Hour. The track moves by `--view-index` with `--dur-slow` / `--nintendo-soft`.
- **Screens** (Location, Settings, Weather Alert, Globe, day detail) open over the panel with `CirrusFrame.openScreen()`. Back closes them.

---

## 4. Color

All colors are tokens in `theme.css`. Roles:

| Role | Token(s) | Used for |
|------|----------|----------|
| Silver button | `--frame-btn-face`, `--frame-btn-text` | Top and bottom rows |
| Cyan selection | `--frame-btn-face-active`, `--frame-btn-text-active` | Hovered middle buttons, pressed buttons, the selected option in Settings |
| Channel green | `--title-block` | Title block only |
| Lime pill | `--pill-face`, `--pill-border` | Location pill only |
| Royal blue | `--panel-face`, `--fiveday-col-face`, `--sixhour-tile-face` | Panel and the tiles on it |
| Current temp | `--temp-current` (white) | The one number on Current |
| High | `--temp-high` (yellow) | Highs on every view |
| Low | `--temp-low` (cyan) | Lows on every view, and freezing temperatures |
| Weekend | `--weekend-text` (yellow) | Saturday/Sunday on 5-Day |
| Wind band | `--wind-band` (navy fade) | Behind the wind readout |
| As-of strip | `--asof-strip` (red-pink fade) | "As of …" timestamp |
| Warning | `--alert-warning-*` (red) | Header, bar, and badge for NWS warnings |
| Watch | `--alert-watch-*` (orange) | Header, bar, and badge for watches |
| UV bands | `--uv-low` … `--uv-extreme` | WHO UV colors on the UV scale |

Rule of thumb: **yellow = high, cyan = low, white = now; silver = a button, cyan
face = the button you're pressing or pointing at; green = where you are; red/orange = an alert.**

Every text/background pair in the frame passes WCAG AA. The pill's lime face darkens
toward the middle so its white large text clears 3:1. Muted button text
(`--frame-btn-text-muted`) clears 4.5:1 on silver.

---

## 5. Typography

- **Family:** `--font-ui` = `'M PLUS Rounded 1c'` (Google Fonts, weights 400/700/800), with Helvetica/Arial fallback. This rounded face is the brand; don't substitute a system stack.
- **Clock:** `--font-digital` = DSEG7 Classic (bundled in `public/fonts`, OFL).
- **Sizes are tokens.** The UI scale is `--fs-xs` … `--fs-xl`. Big numbers use `clamp()` tokens so they scale with the window height:
  - `--hero-temp-size` and `--hero-day-temp-size`
  - `--fiveday-high-font` and `--fiveday-low-font`
  - `--uv-value-font` and `--sixhour-temp-font`
- **Minimums:** body text ≥ 16px; labels and the credit ≥ 11–12px.
- **Numbers** use `tabular-nums` so digits don't jitter.
- The page `<h1>` is visually hidden; the title block is the visual title.

---

## 6. Spacing, shape & layering

- **Spacing:** `--space-1` (4px) … `--space-9` (56px). The panel padding is `--panel-pad-x` and `--panel-pad-top`. `--panel-footer-space` keeps views clear of the footer.
- **Radii:**
  - `--radius-sm`, `--radius-md`, and `--radius-lg` for tiles and screens
  - `--radius-pill` for pills
  - `--pill-gloss-cap-radius` for the convex gloss cap on silver pills
- **Layers** (`--z-*`), from the bottom up:
  1. Satellite
  2. Atmosphere
  3. View
  4. Footer
  5. Screen
  6. Status
  7. Frame
- **Touch targets:** `--touch-min` (44px). Frame buttons, recent-city chips, settings radios, globe markers, and alert tiles all meet it.

---

## 7. Motion

Easings (`theme.css`):

```
--nintendo-spring: cubic-bezier(0.34, 1.56, 0.64, 1)   /* overshoot: entrances, presses */
--nintendo-soft:   cubic-bezier(0.32, 0.72, 0, 1)      /* smooth: view slides, hovers, fades */
```

Durations:

- `--dur-fast`, `--dur-medium`, `--dur-slow`, and `--dur-fade` cover most motion.
- Effect-specific durations: `--dur-pop`, `--dur-squash`, `--dur-bob`, and others.
- `--dur-none` is used by reduced motion.

Distances and transforms are tokens too (`--motion-*`).

Keyframes (`motion.css`): `nintendoPop`, `iconBob`, `hintBounce`, `tempFreezeIn`,
`tempShiver`, `tempHeatShake`, `wiiSquashPress`, `searchPressGlow`, `dockScanDrift`,
`dockScanStatic`, `alertBarDown`, `alertBarUp`, `channelColonBlink`. **Reuse these
before adding new ones.**

| Trigger | Effect |
|---------|--------|
| Up/Down, arrow keys, Page Up/Down, vertical swipe | View track slides one view (`--dur-slow`, soft) |
| Hover on a middle button | Face turns cyan (`--dur-fast` background transition) |
| Press on a frame button or chip | `wiiSquashPress`, one shot |
| Alerts arrive | Alert bar slides down out of the header (`alertBarDown`) |
| Status pill appears | `nintendoPop` |
| Weather icon | `iconBob` loop (decorative) |
| Below 32°F | `.temp--freezing`: fades white → cyan, then shivers |
| 95°F and up | `.temp--hot`: heat shake; JS scales `--heat-amp` / `--heat-speed` up to 120°F |
| Globe moves | Eased camera animation, rendered at half resolution while moving |

### Reduced motion

`motion.css` ends with a `prefers-reduced-motion: reduce` block:

- It cuts every animation and transition to `--dur-none`.
- It stops the loops and the press squash.
- The view track swaps instantly.
- The globe jumps straight to its target.

Any new animation **must** be added to that block.

---

## 8. Day / night & atmosphere

- The Current icon shows a moon when the weather code ends in `n`.
- On the desktop Home menu, `body.theme-day` cross-fades the page sky.
- The atmosphere layer sits inside the panel, behind the views, with `pointer-events: none`. It covers:
  - Rain video, streamed from `/stream/` with byte ranges
  - Snow
  - Fog
  - Lightning, also triggered by thunderstorm and tornado alerts

  Keep these effects subtle.

---

## 9. Responsive

The one width breakpoint is **768px**. Below it, `theme.css` overrides tokens:

- Rows: 54px.
- Header: 58px.
- Title block: 38% of the width.
- Hero, 5-Day, and 6-Hour sizes are smaller.

Layout changes on mobile:

- The middle nav buttons use short names ("5-Day", "6-Hour"). The header still shows the full name.
- 6-Hour becomes a 2×2 grid.
- The Current stats wrap under the wind.
- There is no Home menu. A first visit opens the Location screen.

**Desktop** (≥768px) starts on the Home menu. A gutter rule for 768–1100px keeps Home's tiles off the edges.

Test every UI change at **360, 390, 768, and 1440px**.

---

## 10. Accessibility (non-negotiable)

- **Keyboard:**
  - Every control is a real `<button>` or input.
  - Arrow Up/Down and Page Up/Down step views; Escape goes back.
  - Settings radios use a roving tabindex.
  - The globe takes arrow keys and +/−.
- **Focus:** a visible `--focus-ring` outline on everything (`--focus-ring-on-light` on silver). Never `outline: none` without a replacement.
- **Screen readers:**
  - Views are labeled regions; temperatures carry full `aria-label`s ("High 71 degrees Fahrenheit").
  - Loading and errors are `aria-live`.
  - Settings groups are `role="radiogroup"`.
- **Touch targets** ≥ 44px. **Contrast** AA on every pair (audited).
- **Motion** always respects `prefers-reduced-motion`.

---

## 11. Don'ts (design guardrails)

- Don't copy Nintendo assets, logos, the Wii cursor, or the "supported by weathernews" credit. The cursor (`public/cursors/hand.svg`), icons, and credit line are original.
- Don't hard-code a design value outside `theme.css`; the lint will fail.
- Don't use ternaries in the frontend scripts; this codebase prefers `if` / `else`.
- No purple/violet gradients, decorative blobs, or emoji as UI.
- No generic `system-ui` display font.
- No infinite glow/pulse on buttons or inputs.
- Don't add new chrome; fit features into the button rows, header, panel, or a screen.
- Don't show made-up data. If an API can't supply something, show it as unavailable (UV) or pending (globe).

---

## 12. Quick checklist before shipping a UI change

- [ ] New values added to `theme.css` as tokens; `node --test test/*.test.js` passes
- [ ] Resting state static; motion only on hover/press/focus or an allowed loop
- [ ] Animations use `transform`/`opacity`/`box-shadow` and a `--nintendo-*` easing
- [ ] New animation added to the reduced-motion block
- [ ] Touch targets ≥ 44px; focus ring visible; contrast AA
- [ ] Middle nav labels still name the neighboring view
- [ ] Checked at 360 / 390 / 768 / 1440px
