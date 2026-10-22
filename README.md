# Cirrus

A lightweight weather web app built with Java that fetches live weather data from OpenWeatherMap and displays it through a simple web interface.

## Overview

Cirrus is a short personal project designed to demonstrate a complete end-to-end application: a Java backend that retrieves live data from an external API and a frontend that presents that data to users.

I built it to practice HTTP networking, JSON parsing, and connecting a backend service to a web UI in a single, easy-to-understand codebase.

The interface is styled after a retro console weather channel: silver button rows above and below a royal-blue panel, a green title block with a lime location pill, and big friendly numbers. It is built to feel tactile and playful: springy buttons, bouncing view changes, soft synthesized sounds, and a friendly hand cursor. All artwork, sounds, icons, and the cursor are original.

## Tech Stack

- Java 17
- Maven
- Spark Java
- OkHttp
- Gson
- HTML, CSS, JavaScript (no framework, no build step)
- NASA GIBS for satellite imagery

## Features

- Live current weather, a 5-day forecast, and 6-hour blocks from OpenWeatherMap
- Today's UV index with WHO risk bands
- US weather alerts from the National Weather Service
- A spinning globe of cities with their current weather; zoom in (scroll, pinch, or double tap) and more cities appear
- °F/°C and mph/km/h settings, remembered between visits
- Recent cities remembered between visits
- Original UI sounds and optional calm music, with a mute switch that is remembered
- Springy, tactile motion throughout (see [Feel](#feel))
- Keyboard, swipe, and screen-reader friendly; honors reduced motion with simple fades
- API keys managed through environment variables

## Views

The frame has a silver button row at the top and bottom. The middle buttons step up and down through the view stack and name the neighboring view. Arrow keys, Page Up/Down, vertical swipes on the panel, and scrolling over the frame (one view per flick: scroll down from Current for Today, Tomorrow, and so on) do the same. A column of page dots on the panel's right edge shows where you are in the stack; on desktop, pointing at a dot shows its view's name and clicking jumps straight there.

| View | Shows |
|------|-------|
| UV Index | Today's UV value, its WHO band (Low → Extreme) on a color scale, and advice |
| Current | Temperature, condition, icon (a moon at night), and wind, with feels-like, humidity, clouds, visibility, pressure, sunrise, and sunset in rounded reading bubbles |
| Today | Today's high and low, condition, and wind, with rain chance and precipitation bubbles |
| Tomorrow | The same for tomorrow |
| 5-Day Forecast | Five columns of day, icon, high, and low; weekend names in yellow. Pick a day to open its detail |
| 6-Hour Weather | Tomorrow in four blocks (12–6 a.m., 6 a.m.–12 p.m., 12–6 p.m., 6 p.m.–12 a.m.) |

Other screens:

- **Location**: tap the lime pill to search; recent cities are listed as buttons.
- **Settings** (top right): a Units card (°F or °C, mph or km/h) and a Sound card (sound effects on or off, music on or off).
- **Globe** (bottom right): zoom out/in, Next region, rotate left/right, Restore, End. Drag to spin it. Scroll, pinch (trackpad or two fingers), or double tap to zoom toward that spot. Zooming in brings out more cities: 42 major cities always, 53 more from about halfway in, and 73 more closer still. Picking a city opens its weather; Back returns to the globe.
- **Weather Alert**: when the NWS has an active alert, the header turns red (warnings) or orange (watches), a bar shows under the header, and the alert screen lists the details.
- **Home** (desktop only): the channel menu shown at launch. Each tile zooms open into its view.

Loading shows bouncing dots in the middle of the panel ("Tuning in to Tokyo…"); problems show a friendly card with a **Try again** button ("Couldn't find that town. Try another spelling?").

## Feel

Cirrus aims to feel like a console channel: charming, tactile, and polished. Every bit of it is original and only inspired by that feel.

- **Buttons** grow with a spring and catch a sweep of light when you point at them, and squash and bounce back when pressed, even on a quick click. Phones that support it give a tiny buzz.
- **Views** slide in from the side they come from and land with a small bounce. Titles, labels, and the wind line arrive with them, big numbers count up, and screens pop in (a 5-Day day grows out of its column).
- **Weather icons** idle gently: the sun turns and its rays breathe, clouds drift, rain drips, snow sways, the moon glows.
- **Launching**: on desktop a Home tile grows into the frame, and Home zooms back into it; phones open with a Cirrus tile that grows into the frame. Each takes under a second.
- **Cursor**: on computers Cirrus draws its own hand that leans as it moves, hops onto buttons, and pokes when you click; touch screens get a soft ripple instead.
- **Sound** is made on the spot from plain tones (nothing is a recording): a light tick on hover, a pop on press, a two-note chime as a view opens, a lower blip for Back, a soft tone for NWS warnings, and optional slow music. Sound starts only after your first click, tap, or key press.
- **Idle**: after a quiet minute the globe turns by itself or the satellite picture slowly pans; any input brings things back at once.
- **Surprises**: a sun clicked five times quickly winks at you, and on snowy days snow piles up on the frame's ledges.

**Reduced motion** turns off the bounces, idle animation, count-ups, launch zooms, drawn cursor, and easter-egg spin, and swaps them for short fades. High contrast mode keeps the system cursor.

All CSS timings, spring curves, and colors are tokens in `public/theme.css`; everything only JavaScript needs (sound pitches and volumes, the count-up length, the idle delay, cursor lean, how far a scroll or pinch zooms) is in `public/feel-config.js`.

### Libraries

None were added. Each of these was weighed and done by hand instead:

- **Springs:** CSS `linear()` timing curves sampled from a damped spring (with overshooting `cubic-bezier` fallbacks) give the bounce without a motion library such as Motion, and run off the main thread.
- **Sound:** a few Web Audio oscillators with volume envelopes cover every sound; Tone.js would add roughly 90 KB gzipped for scheduling features these sounds don't need.
- **Globe idle and glide:** the existing hand-built canvas globe already moves its camera, so no globe or map library is needed.

## Running locally

1. Get a free OpenWeatherMap API key and set it as `WEATHER_API_KEY`, either as an environment variable or in a `touch.env` file at the project root.
2. Build and start the server:
   ```bash
   mvn package
   java -jar target/weather-app-1.0-SNAPSHOT.jar
   ```
3. Open <http://localhost:4567/index.html>. Set `PORT` to use a different port.

When the frontend is served from GitHub Pages it calls the hosted backend instead (`BACKEND_URL` in `public/script.js`). Set `ALLOWED_ORIGINS` on the server to control CORS.

## Running the tests

```bash
mvn test                   # backend: 105 JUnit tests
node --test test/*.test.js # frontend: 38 Node tests, no install needed
```

The frontend tests run the plain scripts against a small DOM stub. They also include a lint that fails if any CSS file outside `theme.css` contains a literal color, length, duration, or easing curve.

## API

Every endpoint returns JSON. Errors look like `{"error": "message"}`.

The rate limit is **30 upstream calls per minute per client IP**. Only requests that actually reach OpenWeatherMap or the NWS count toward it; cache hits are free. Going over returns `429`.

### Existing endpoints

| Endpoint | Returns | Cache |
|----------|---------|-------|
| `GET /health` | `{"status":"ok"}` | — |
| `GET /weather?city=` | Current conditions for a city | 10 min |
| `GET /forecast?city=` | Five forecast days | 10 min |
| `GET /alerts?lat=&lon=` | `{"alerts":[…]}` from the NWS (US only; empty elsewhere) | 5 min |
| `GET /stream/:file` | Media from `public/media` with byte-range support (`206 Partial Content`) for iOS Safari | — |

These routes and their response shapes did not change in the redesign. A city that isn't found is remembered for 60 seconds, so repeated misspellings don't spend the rate limit.

### `GET /sixhour?city=`

Six-hour blocks built from the same OpenWeatherMap 5-day/3-hour forecast that `/forecast` uses. The raw forecast is cached once and shared, so calling both routes costs one upstream call.

```json
{
  "timezoneOffset": -18000,
  "blocks": [
    {
      "day": "Wed",
      "date": "2026-10-21",
      "startHour": 18,
      "high": 69.24,
      "low": 65.73,
      "rainChance": 0,
      "condition": "clear sky",
      "weatherCode": "01n",
      "conditionId": 800
    }
  ]
}
```

- Blocks are grouped by the city's local date, starting at 0, 6, 12, or 18.
- `high` and `low` are the warmest and coolest readings in the block.
- `rainChance` is the highest chance in the block, as a percentage.
- The condition is the most severe one in the block (thunderstorm, then snow, rain, and so on).

Errors: `400` (missing city), `404` (city not found), `429`, `500`.

### `GET /uv?lat=&lon=`

Today's UV index for a point.

```json
{ "value": 5.82, "category": "High", "date": 1792670400 }
```

`category` is the WHO band of the rounded value: Low (0–2), Moderate (3–5), High (6–7), Very High (8–10), Extreme (11+).

Responses are cached for an hour per point, rounded to two decimal places.

Errors: `400` (missing, non-numeric, or out-of-range coordinates), `429`, `503` (upstream unavailable; the UV view shows "UV index unavailable").

> This uses OpenWeatherMap's older `/data/2.5/uvi` endpoint, which still answers on the free plan but is deprecated. The supported replacement (One Call 3.0) needs a paid subscription. If the old endpoint is retired, the UV view will show "unavailable" rather than made-up numbers.

### `GET /globe?region=`

Current weather for a fixed list of major cities in one region.

Regions:

- `north-america`
- `south-america`
- `europe`
- `africa`
- `asia`
- `oceania`

There are 42 cities in total, at most 8 per region.

```json
{
  "region": "north-america",
  "cities": [
    {
      "name": "Seattle", "lat": 47.61, "lon": -122.33, "pending": false,
      "temperature": 55.74, "conditionId": 804, "weatherCode": "04n",
      "condition": "overcast clouds"
    },
    { "name": "Chicago", "lat": 41.88, "lon": -87.63, "pending": true }
  ]
}
```

The free plan has no multi-city endpoint, so each city is its own upstream call. To stay inside the rate limit:

- Each city is cached for 30 minutes.
- A request fetches at most 8 uncached cities.
- If the rate limit trips partway through, or one city fails, the rest come back `"pending": true` instead of failing the whole region. The globe draws pending cities as plain dots and asks again 20 seconds later.
- The globe only requests the regions facing the camera.

The extra cities that appear as you zoom in (`public/globe-cities.js`) don't use this endpoint: each one is a plain `GET /weather?city=` call, made only while that city is on screen at a zoom where it shows. The globe makes at most 12 of these a minute so your own searches keep room under the rate limit, waits a whole minute if the server answers `429`, and refreshes a city's weather after 10 minutes.

Errors: `400` (missing or unknown region), `503`.

## Architecture

### Backend (`src/main/java/com/weatherapp/`)

Each upstream source follows the same layering: client → parser → service → route.

- `service/OpenWeatherClient` — HTTP calls to OpenWeatherMap (weather, forecast, UV, weather by coordinates)
- `service/NwsAlertClient` — HTTP calls to the National Weather Service
- `service/WeatherResponseParser`, `ForecastParser`, `SixHourParser`, `UvParser`, `AlertParser` — JSON → model
- `service/WeatherService`, `UvService`, `GlobeService`, `AlertService` — caching (`WeatherCache`, `NotFoundCache`) and rate-limit checks
- `service/GlobeCities` — the fixed city list for the globe
- `server/WeatherServer` — Spark routes. The route handlers are static methods so tests can call them directly
- `server/RateLimiter`, `ClientIpResolver`, `CorsConfig`, `MediaStreamRoute` — shared plumbing
- `model/` — `WeatherData`, `ForecastDay`, `SixHourBlock`, `SixHourForecast`, `UvIndex`, `GlobeCity`, `GlobeMarker`, `GlobeRegion`, `WeatherAlert`

### Frontend (`public/`)

| File | Owns |
|------|------|
| `theme.css` | Every color, gradient, shadow, radius, spacing, duration, and spring curve, as CSS custom properties (mobile overrides at the bottom) |
| `base.css` | Reset, fonts, page sky, cursor (and the drawn hand and tap ripple), focus ring |
| `frame.css` | Button rows, header, panel, page dots, reading bubbles, loading dots, error card, all six views, and the launch zoom |
| `channels.css` | Desktop Home menu |
| `alerts.css` | Alert bar, header variants, alert screen |
| `globe.css` | Globe screen and markers |
| `weather-atmosphere.css` | Rain, snow, fog, and lightning overlays |
| `motion.css` | Keyframes, button feel (grow, shine, squash), icon idle motion, loader, easter eggs, and the reduced-motion overrides |
| `feel-config.js` | The timings and amounts only JavaScript uses: sounds, count-up, view-slide overshoot, scrolling between views, globe glide and zoom, cursor lean, idle delay, easter eggs |
| `units.js` | °F/°C and mph/km/h formatting, city-local dates and times, saved settings |
| `feel.js` | Button press squash, shine layers, hover tick and press pop, phone buzz |
| `sound.js` | The sound engine: synthesized effects, the music loop, and the remembered switches |
| `pointer.js` | The drawn hand cursor (lean, hop, poke) and the touch ripple |
| `frame.js` | Button rows, view stack and its bouncing slide, screens popping in and out, page dots, clock, keys, swipe, and scroll |
| `countup.js` | Big numbers rolling up when a view opens |
| `launch.js` | Channel launch zoom from a Home tile (and back), and the phone intro |
| `idle.js` | Attract mode after a quiet minute |
| `eggs.js` | The winking sun and snow caps |
| `views.js` | Renders Current, Today, Tomorrow, 5-Day, 6-Hour, UV, and day detail |
| `search.js` | Location screen and recent cities |
| `settings.js` | Settings screen (Units and Sound cards) |
| `globe.js` | Canvas globe (orthographic projection of NASA GIBS imagery), city markers, drag and glide, scroll/pinch/double-tap zoom, idle spin |
| `globe-cities.js` | The extra cities that appear as you zoom in, with their tier and search query |
| `alerts.js` | Alert bar, badge, and alert screen |
| `channels.js` | Desktop Home menu |
| `atmosphere.js`, `atmo-*.js` | Weather overlays |
| `script.js` | Fetching, caching, and wiring the modules together |

See [DESIGN.md](DESIGN.md) for the design system.

## Credits

- Weather data: [OpenWeather](https://openweathermap.org/)
- Alerts: US National Weather Service
- Satellite imagery: NASA GIBS (Blue Marble)
- Clock digits: DSEG7 font (SIL Open Font License, see `public/fonts/DSEG-LICENSE.txt`)

## Author

Solo project, maintained by June Muller.
