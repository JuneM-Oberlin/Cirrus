/* Globe: a satellite globe drawn on a <canvas> from one NASA GIBS
   Blue Marble image, with live weather markers for a fixed list of major
   cities, and more cities (globe-cities.js) as you zoom in. No library —
   just the orthographic projection:

   Forward (lat/lon -> screen), with the globe facing point (lat0, lon0):
     cos c = sin(lat0) sin(lat) + cos(lat0) cos(lat) cos(lon - lon0)   (> 0 means visible)
     x = cos(lat) sin(lon - lon0)
     y = cos(lat0) sin(lat) - sin(lat0) cos(lat) cos(lon - lon0)
   Inverse (screen -> lat/lon), for a point (x, y) on the unit disc with z = sqrt(1 - x^2 - y^2):
     lat = asin(z sin(lat0) + y cos(lat0))
     lon = lon0 + atan2(x, z cos(lat0) - y sin(lat0))

   Zooming in tilts the view: the facing point slides south of the spot
   you are looking at and the disc slides down, so the horizon curves
   across the top of the panel like the references.

   Zoom levels are numbers from 0 (the whole Earth) to the last entry of
   ZOOM_LEVELS. The buttons and keys step between whole levels; a scroll
   wheel, a trackpad pinch, two fingers, or a double tap can stop anywhere
   in between, always zooming toward the spot under the pointer. */

const CirrusGlobe = (function () {
    const DEG = Math.PI / 180;

    // Region centres the Next button cycles through (cities come from /globe).
    const REGIONS = [
        { id: "north-america", name: "North America", lat: 38, lon: -100 },
        { id: "south-america", name: "South America", lat: -18, lon: -62 },
        { id: "europe", name: "Europe", lat: 48, lon: 14 },
        { id: "africa", name: "Africa", lat: 4, lon: 20 },
        { id: "asia", name: "Asia", lat: 30, lon: 112 },
        { id: "oceania", name: "Oceania", lat: -27, lon: 140 },
    ];

    // Globe radius as a share of the panel's shorter side, per zoom level.
    const ZOOM_LEVELS = [0.42, 0.8, 1.35, 2.2, 3.4, 5.6];
    const DEFAULT_LEVEL = 2;
    const MAX_LEVEL = ZOOM_LEVELS.length - 1;
    const ROTATE_STEP = 20;
    const PAN_STEP = 10;
    const MAX_TILT = 58 * DEG;
    const HORIZON_SHARE = 0.36;
    const MAX_REGIONS_PER_LOOK = 2;
    const PENDING_RETRY_MS = 20000;
    // Extra cities appear as you zoom in: tier 2 from level 2.5, tier 3 from
    // level 3.5. Each one's weather is its own /weather call, so at most
    // EXTRAS_PER_MINUTE load each minute, leaving room under the server's
    // rate limit (30 a minute) for your own searches; if the server says
    // "too many" anyway, they wait a whole minute. Loaded weather is
    // refreshed after ten minutes, like the server's cache.
    const TIER_LEVELS = { 2: 2.5, 3: 3.5 };
    const EXTRAS_PER_MINUTE = 12;
    const EXTRA_REFRESH_MS = 10 * 60 * 1000;
    const MINUTE_MS = 60 * 1000;
    // The whole world comes first as a quick 2048-wide picture, then (with
    // the GPU renderer) a sharper 4096-wide one. From DETAIL_FROM_LEVEL in, a
    // close-up picture of just the area in view loads after each move,
    // sized to be about as sharp as the screen.
    const BASE_SIZE = { width: 2048, height: 1024 };
    const SHARP_BASE_SIZE = { width: 4096, height: 2048 };
    const DETAIL_FROM_LEVEL = 1.5;

    let deps = {
        frame: null,
        fetchRegion: async () => null,
        fetchCity: async () => null,
        onVisit: () => {},
        onEnd: () => {},
        formatTemp: (f) => Math.round(f) + "°",
        iconPath: () => "icons/default.png",
        prefersReducedMotion: () => false,
    };

    const view = { lat: 38, lon: -100, level: DEFAULT_LEVEL, radius: 0, tilt: 0 };
    let home = { lat: 38, lon: -100 };
    let regionIndex = 0;
    let base = null;
    // the two latest close-up pictures, older first; the newer is drawn on top
    let details = [null, null];
    // the WebGL renderer, null when the browser can't (undefined until tried)
    let gpu;
    let detailTimer = null;
    let animation = null;
    // while the wheel or a double tap is zooming: the level it is heading
    // for, and the screen point it zooms toward
    let zoomTarget = null;
    let zoomPoint = { x: 0, y: 0 };
    let settleTimer = null;
    let drawFrame = null;
    let isOpen = false;
    const regions = {};
    // weather for the extra cities, by search query
    const extras = {};
    // when each recent extra city fetch started, for the per-minute budget
    let extraFetchTimes = [];
    let extrasPausedUntil = 0;
    let extrasTimer = null;
    let extrasDueAt = 0;
    let markersTimer = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function token(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function canvasSize() {
        const canvas = byId("globeCanvas");
        return { width: canvas.clientWidth, height: canvas.clientHeight };
    }

    function clampLevel(level) {
        return Math.max(0, Math.min(MAX_LEVEL, level));
    }

    // The globe's size for any level, whole or in between. Between two
    // levels the size grows by the same factor for each equal step, so
    // zooming feels even all the way in.
    function shareFor(level) {
        const safe = clampLevel(level);
        const lower = Math.min(Math.floor(safe), MAX_LEVEL - 1);
        const t = safe - lower;
        return ZOOM_LEVELS[lower] * Math.pow(ZOOM_LEVELS[lower + 1] / ZOOM_LEVELS[lower], t);
    }

    // The opposite of shareFor: which level gives the globe this size.
    function levelForShare(share) {
        if (share <= ZOOM_LEVELS[0]) {
            return 0;
        }
        for (let lower = 0; lower < MAX_LEVEL; lower++) {
            const upper = ZOOM_LEVELS[lower + 1];
            if (share <= upper) {
                return lower + Math.log(share / ZOOM_LEVELS[lower]) / Math.log(upper / ZOOM_LEVELS[lower]);
            }
        }
        return MAX_LEVEL;
    }

    // Radius in CSS pixels for a zoom level.
    function radiusFor(level) {
        const size = canvasSize();
        return shareFor(level) * Math.min(size.width, size.height);
    }

    // How far to tilt so the horizon sits near the top of the panel. The
    // whole Earth (level 0) faces you straight on; the tilt grows in by level 1.
    function tiltFor(level, radius) {
        const height = canvasSize().height;
        const sinTilt = Math.min(Math.max(1 - (HORIZON_SHARE * height) / radius, 0), Math.sin(MAX_TILT));
        return Math.asin(sinTilt * Math.min(level, 1));
    }

    function wrapLon(lon) {
        return ((lon + 540) % 360) - 180;
    }

    function clampLat(lat) {
        return Math.max(-75, Math.min(75, lat));
    }

    // Where the camera is for the current view (all in CSS pixels). Far
    // south, the tilt is cut back so the facing point never goes past the
    // South Pole; otherwise the camera would stop following view.lat.
    function camera(width, height, scale) {
        const radius = view.radius * scale;
        const tilt = Math.min(view.tilt, (view.lat + 89.9) * DEG);
        const lat0 = Math.min(89.9, view.lat - tilt / DEG);
        return {
            radius,
            cx: width / 2,
            cy: height / 2 + radius * Math.sin(tilt),
            sinLat0: Math.sin(lat0 * DEG),
            cosLat0: Math.cos(lat0 * DEG),
            lon0: view.lon,
        };
    }

    function project(lat, lon, cam) {
        const phi = lat * DEG;
        const dLambda = (lon - cam.lon0) * DEG;
        const cosC = cam.sinLat0 * Math.sin(phi) + cam.cosLat0 * Math.cos(phi) * Math.cos(dLambda);
        const x = Math.cos(phi) * Math.sin(dLambda);
        const y = cam.cosLat0 * Math.sin(phi) - cam.sinLat0 * Math.cos(phi) * Math.cos(dLambda);
        return {
            visible: cosC > 0.05,
            depth: cosC,
            x: cam.cx + x * cam.radius,
            y: cam.cy - y * cam.radius,
        };
    }

    // The place under a point on the screen (CSS pixels), or null for the
    // sky around the globe. render() runs the same inverse projection
    // inline for every pixel.
    function placeAt(x, y) {
        const size = canvasSize();
        const cam = camera(size.width, size.height, 1);
        const unitX = (x - cam.cx) / cam.radius;
        const unitY = (cam.cy - y) / cam.radius;
        const rho2 = unitX * unitX + unitY * unitY;
        if (rho2 > 1) {
            return null;
        }
        const z = Math.sqrt(1 - rho2);
        // rounding can push this a hair past 1 right at a pole, where asin
        // would give NaN, so it is kept inside -1..1
        const sinLat = Math.max(-1, Math.min(1, z * cam.sinLat0 + unitY * cam.cosLat0));
        return {
            lat: Math.asin(sinLat) / DEG,
            lon: wrapLon(cam.lon0 + Math.atan2(unitX, z * cam.cosLat0 - unitY * cam.sinLat0) / DEG),
        };
    }

    /* ---------- Imagery ---------- */

    function gibsUrl(minLon, minLat, maxLon, maxLat, size) {
        return [
            "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
            "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap",
            "&LAYERS=BlueMarble_ShadedRelief_Bathymetry",
            "&FORMAT=image/jpeg&TRANSPARENT=false&SRS=EPSG:4326",
            `&WIDTH=${size.width}&HEIGHT=${size.height}`,
            `&BBOX=${minLon},${minLat},${maxLon},${maxLat}`,
        ].join("");
    }

    // Reads an image's pixels, for the canvas 2D renderer to sample.
    function pixelsOf(image) {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }

    // Loads a picture covering bounds { minLon, minLat, maxLon, maxLat }.
    // The GPU renderer takes the image itself; the canvas 2D one needs its pixels.
    function loadPicture(url, bounds) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const picture = Object.assign({ image: img, width: img.naturalWidth, height: img.naturalHeight }, bounds);
                if (!gpu) {
                    picture.data = pixelsOf(img);
                }
                resolve(picture);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    function loadBase() {
        if (base) {
            return;
        }
        setStatus("Fetching the satellite view…", { busy: true });
        const bounds = { minLon: -180, minLat: -90, maxLon: 180, maxLat: 90 };
        loadPicture(gibsUrl(-180, -90, 180, 90, BASE_SIZE), bounds)
            .then((picture) => {
                base = picture;
                if (gpu) {
                    gpu.setPicture("base", picture);
                }
                setStatus("");
                render(1);
                placeMarkers();
                loadSharpBase(bounds);
            })
            .catch(() => setStatus("The satellite view isn't available right now."));
    }

    // The GPU renderer can hold a picture twice as sharp, which loads in the
    // background (it takes a few seconds) and swaps in when it arrives.
    function loadSharpBase(bounds) {
        if (!gpu || gpu.maxTextureSize < SHARP_BASE_SIZE.width) {
            return;
        }
        loadPicture(gibsUrl(-180, -90, 180, 90, SHARP_BASE_SIZE), bounds)
            .then((picture) => {
                base = picture;
                gpu.setPicture("base", picture);
                if (isOpen) {
                    render(1);
                }
            })
            .catch(() => {});
    }

    // The area on screen: the lowest and highest latitude and longitude
    // under a grid of points across the canvas. Longitudes are measured
    // from the middle of the view so an area across the date line still
    // works, then cut off at the date line.
    function visibleArea() {
        const size = canvasSize();
        const steps = 8;
        const area = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
        for (let row = 0; row <= steps; row++) {
            for (let col = 0; col <= steps; col++) {
                const place = placeAt(size.width * col / steps, size.height * row / steps);
                if (!place) {
                    continue;
                }
                const lonFromMiddle = wrapLon(place.lon - view.lon);
                area.minLon = Math.min(area.minLon, lonFromMiddle);
                area.maxLon = Math.max(area.maxLon, lonFromMiddle);
                area.minLat = Math.min(area.minLat, place.lat);
                area.maxLat = Math.max(area.maxLat, place.lat);
            }
        }
        if (area.minLon === Infinity) {
            return null;
        }
        area.minLon = Math.max(-180, view.lon + area.minLon);
        area.maxLon = Math.min(180, view.lon + area.maxLon);
        return area;
    }

    // How many degrees one screen pixel covers in the middle of the view.
    function degreesPerPixel() {
        return 1 / DEG / (view.radius * pixelRatio());
    }

    // Is this picture sharp enough for the view, and does it cover the area?
    function pictureFits(picture, area, wanted) {
        if (!picture) {
            return false;
        }
        const covers = picture.minLon <= area.minLon && picture.maxLon >= area.maxLon
            && picture.minLat <= area.minLat && picture.maxLat >= area.maxLat;
        const sharpEnough = (picture.maxLon - picture.minLon) / picture.width <= wanted * 1.5;
        return covers && sharpEnough;
    }

    // After a move, fetch a close-up picture of the area in view (with a
    // margin around it), unless the latest one already covers it sharply.
    function scheduleDetail() {
        clearTimeout(detailTimer);
        if (view.level < DETAIL_FROM_LEVEL) {
            return;
        }
        detailTimer = setTimeout(() => {
            const area = visibleArea();
            if (!area) {
                return;
            }
            const wanted = degreesPerPixel();
            if (pictureFits(details[1], area, wanted)) {
                return;
            }
            const margin = 0.15;
            const spanLon = area.maxLon - area.minLon;
            const spanLat = area.maxLat - area.minLat;
            const bounds = {
                minLon: Math.max(-180, area.minLon - spanLon * margin),
                maxLon: Math.min(180, area.maxLon + spanLon * margin),
                minLat: Math.max(-90, area.minLat - spanLat * margin),
                maxLat: Math.min(90, area.maxLat + spanLat * margin),
            };
            const most = CirrusConfig.globeLook.detailMaxPx;
            const size = {
                width: Math.round(Math.min(most, Math.max(256, (bounds.maxLon - bounds.minLon) / wanted))),
                height: Math.round(Math.min(most, Math.max(256, (bounds.maxLat - bounds.minLat) / wanted))),
            };
            loadPicture(gibsUrl(bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat, size), bounds)
                .then((picture) => {
                    details = [details[1], picture];
                    if (gpu) {
                        if (details[0]) {
                            gpu.setPicture("a", details[0]);
                        }
                        gpu.setPicture("b", picture);
                    }
                    if (isOpen && !animation && zoomTarget === null) {
                        render(1);
                    }
                })
                .catch(() => {});
        }, 400);
    }

    /* ---------- Drawing ---------- */

    // The screen's pixel density, capped so very dense phones don't do
    // more work than anyone could see.
    function pixelRatio() {
        return Math.min(window.devicePixelRatio || 1, CirrusConfig.globeLook.maxPixelRatio);
    }

    // "#1d4ea8" or "rgba(120, 190, 255, 0.55)" -> [r, g, b, a] from 0 to 1.
    function colorParts(css) {
        const value = css.trim();
        if (value.startsWith("#")) {
            const rgb = parseColor(value);
            return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1];
        }
        const numbers = value.replace(/[^\d.,]/g, "").split(",").map(Number);
        let alpha = 1;
        if (numbers.length > 3) {
            alpha = numbers[3];
        }
        return [numbers[0] / 255, numbers[1] / 255, numbers[2] / 255, alpha];
    }

    // The globe's colours (from theme.css) and lighting (from feel-config.js).
    function lookSettings() {
        const look = CirrusConfig.globeLook;
        const glow = colorParts(token("--globe-glow"));
        const light = look.light;
        const length = Math.hypot(light[0], light[1], light[2]);
        return {
            ocean: colorParts(token("--globe-ocean")).slice(0, 3),
            atmosphere: colorParts(token("--globe-atmosphere")).slice(0, 3),
            glow,
            light: light.map((part) => part / length),
            ambient: look.ambient,
            diffuse: look.diffuse,
            specular: look.specular,
            shininess: look.shininess,
            rim: look.rim,
            rimPower: look.rimPower,
            saturation: look.saturation,
            glowWidth: look.glowWidth,
        };
    }

    // The GPU draws every frame at the screen's full resolution.
    function drawWithGpu() {
        const canvas = byId("globeCanvas");
        const size = canvasSize();
        const ratio = pixelRatio();
        const width = Math.round(size.width * ratio);
        const height = Math.round(size.height * ratio);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        gpu.draw({ width, height, cam: camera(width, height, ratio), look: lookSettings() });
    }

    // scale only matters to the canvas 2D renderer, which draws at half
    // resolution while the globe moves to keep up.
    function render(scale) {
        const canvas = byId("globeCanvas");
        const size = canvasSize();
        if (!size.width || !size.height) {
            return;
        }
        if (gpu) {
            drawWithGpu();
            describe();
            return;
        }
        const width = Math.round(size.width * scale);
        const height = Math.round(size.height * scale);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        const cam = camera(width, height, scale);
        const image = ctx.createImageData(width, height);
        const out = image.data;
        const ocean = parseColor(token("--globe-ocean"));

        // Walk every pixel inside the disc and look up its colour.
        for (let py = 0; py < height; py++) {
            const y = (cam.cy - py) / cam.radius;
            if (y > 1 || y < -1) {
                continue;
            }
            for (let px = 0; px < width; px++) {
                const x = (px - cam.cx) / cam.radius;
                const rho2 = x * x + y * y;
                if (rho2 > 1) {
                    continue;
                }
                const z = Math.sqrt(1 - rho2);
                const lat = Math.asin(z * cam.sinLat0 + y * cam.cosLat0) / DEG;
                const lon = wrapLon(cam.lon0 + Math.atan2(x, z * cam.cosLat0 - y * cam.sinLat0) / DEG);

                let r = ocean[0];
                let g = ocean[1];
                let b = ocean[2];
                // the sharpest picture that covers this spot
                let tex = base;
                for (let d = details.length - 1; d >= 0; d--) {
                    const detail = details[d];
                    if (detail && lat >= detail.minLat && lat <= detail.maxLat
                        && lon >= detail.minLon && lon <= detail.maxLon) {
                        tex = detail;
                        break;
                    }
                }
                if (tex) {
                    const u = Math.floor(((lon - tex.minLon) / (tex.maxLon - tex.minLon)) * (tex.width - 1));
                    const v = Math.floor(((tex.maxLat - lat) / (tex.maxLat - tex.minLat)) * (tex.height - 1));
                    const t = (v * tex.width + u) * 4;
                    r = tex.data[t];
                    g = tex.data[t + 1];
                    b = tex.data[t + 2];
                }

                // darken toward the edge so it reads as a sphere
                const shade = 0.5 + 0.5 * z;
                const i = (py * width + px) * 4;
                out[i] = r * shade;
                out[i + 1] = g * shade;
                out[i + 2] = b * shade;
                out[i + 3] = 255;
            }
        }
        ctx.putImageData(image, 0, 0);

        // a soft atmosphere glow just outside the edge, painted behind the globe
        ctx.globalCompositeOperation = "destination-over";
        const glow = ctx.createRadialGradient(cam.cx, cam.cy, cam.radius * 0.97, cam.cx, cam.cy, cam.radius * 1.07);
        glow.addColorStop(0, token("--globe-glow"));
        glow.addColorStop(1, token("--globe-glow-edge"));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cam.cx, cam.cy, cam.radius * 1.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        describe();
    }

    function parseColor(hex) {
        const value = hex.replace("#", "");
        return [
            parseInt(value.slice(0, 2), 16),
            parseInt(value.slice(2, 4), 16),
            parseInt(value.slice(4, 6), 16),
        ];
    }

    function describe() {
        const nearest = nearestRegion(view.lat, view.lon);
        byId("globeCanvas").setAttribute("aria-label",
            "Satellite globe centred on " + nearest.name + ", zoom level " + (Math.round(view.level) + 1) + " of " + ZOOM_LEVELS.length);
    }

    /* ---------- Markers ---------- */

    function markerLabel(city) {
        if (city.pending) {
            return city.name;
        }
        return city.name + " " + deps.formatTemp(city.temperature);
    }

    // The extra cities that belong at this zoom, with their weather once
    // it has loaded (until then they show as loading).
    function extraCities() {
        return CirrusGlobeCities
            .filter((entry) => view.level >= TIER_LEVELS[entry.tier])
            .map((entry) => {
                if (extras[entry.query]) {
                    return extras[entry.query];
                }
                return Object.assign({ pending: true }, entry);
            });
    }

    // The cities that land inside the canvas on the near side of the
    // globe, each with the point where it lands.
    function citiesOnScreen(cities) {
        const size = canvasSize();
        const cam = camera(size.width, size.height, 1);
        return cities
            .map((city) => ({ city, point: project(city.lat, city.lon, cam) }))
            .filter((item) => item.point.visible
                && item.point.x > 0 && item.point.x < size.width
                && item.point.y > 0 && item.point.y < size.height);
    }

    // Major cities get first pick of space for their labels, then tier 2,
    // then tier 3; within a tier, the ones facing you most go first.
    function byImportance(a, b) {
        const tierA = a.city.tier || 1;
        const tierB = b.city.tier || 1;
        if (tierA !== tierB) {
            return tierA - tierB;
        }
        return b.point.depth - a.point.depth;
    }

    // Every city the globe knows about at this zoom.
    function allCities() {
        const cities = [];
        Object.values(regions).forEach((region) => region.cities.forEach((city) => cities.push(city)));
        extraCities().forEach((city) => cities.push(city));
        return cities;
    }

    // Weather arriving for several cities at once redraws the markers once.
    // While a marker is being pressed or has keyboard focus, rebuilding them
    // would swallow the click or make a screen reader read it out again, so
    // the markers on screen are just brought up to date instead.
    function placeMarkersSoon() {
        clearTimeout(markersTimer);
        markersTimer = setTimeout(() => {
            if (!isOpen || animation || zoomTarget !== null) {
                return;
            }
            const layer = byId("globeMarkers");
            const shown = new Set([...layer.querySelectorAll(".globe-marker")].map((button) => button.dataset.city));
            const missing = citiesOnScreen(allCities()).some((item) => !shown.has(item.city.name));
            if (layer.querySelector(".globe-marker:active")) {
                refreshMarkers();
                // new cities wait until the press is over
                if (missing) {
                    placeMarkersSoon();
                }
                return;
            }
            // new cities (a region just loaded) need a rebuild, which moves
            // focus to the new copy of the focused marker
            if (layer.contains(document.activeElement) && !missing) {
                refreshMarkers();
                return;
            }
            placeMarkers();
        }, 120);
    }

    // Updates the markers already on screen without replacing them.
    function refreshMarkers() {
        const cities = allCities();
        byId("globeMarkers").querySelectorAll(".globe-marker").forEach((button) => {
            const city = cities.find((item) => item.name === button.dataset.city);
            if (city) {
                describeMarker(button, city);
            }
        });
    }

    // Fills in a marker's weather icon, label, and spoken description.
    function describeMarker(button, city) {
        button.classList.toggle("is-pending", Boolean(city.pending));
        let icon = button.querySelector(".globe-marker-icon");
        if (!city.pending) {
            if (!icon) {
                icon = document.createElement("img");
                icon.className = "globe-marker-icon";
                icon.alt = "";
                // a drag that starts on the icon turns the globe, not the picture
                icon.draggable = false;
                button.insertBefore(icon, button.querySelector(".globe-label"));
            }
            icon.src = deps.iconPath(city.conditionId, city.weatherCode);
        }
        button.querySelector(".globe-label").textContent = markerLabel(city);

        let description = city.name;
        if (city.pending) {
            description += ": weather loading";
        } else {
            description += ": " + deps.formatTemp(city.temperature) + ", " + (city.condition || "");
        }
        button.setAttribute("aria-label", description + ". Open forecast");
    }

    function placeMarkers() {
        clearTimeout(markersTimer);
        const layer = byId("globeMarkers");
        const size = canvasSize();
        const placed = [];
        const cities = allCities();

        // the markers are rebuilt, so keyboard focus moves to the new copy
        let focusedName = null;
        if (layer.contains(document.activeElement)) {
            focusedName = document.activeElement.dataset.city;
        }

        layer.replaceChildren();
        citiesOnScreen(cities)
            .sort(byImportance)
            .forEach(({ city, point }) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "globe-marker";
                button.dataset.city = city.name;
                button.style.left = point.x + "px";
                button.style.top = point.y + "px";
                // near the right edge the label goes on the left of its dot
                if (point.x > size.width * 0.62) {
                    button.classList.add("is-flipped");
                }

                const dot = document.createElement("span");
                dot.className = "globe-dot";
                const label = document.createElement("span");
                label.className = "globe-label";
                button.append(dot, label);
                describeMarker(button, city);

                // Skip a label that would sit on top of one already placed.
                // The box covers the dot plus the label on whichever side it sits.
                const labelWidth = label.textContent.length * 9 + 40;
                const box = { left: point.x, right: point.x + labelWidth, top: point.y - 14, bottom: point.y + 14 };
                if (button.classList.contains("is-flipped")) {
                    box.left = point.x - labelWidth;
                    box.right = point.x;
                }
                const overlaps = placed.some((other) => box.left < other.right && box.right > other.left
                    && box.top < other.bottom && box.bottom > other.top);
                if (overlaps) {
                    button.classList.add("is-compact");
                } else {
                    placed.push(box);
                }

                // extra cities search by their query, so the right town answers
                button.addEventListener("click", () => deps.onVisit(city.query || city.name));
                layer.appendChild(button);
                if (city.name === focusedName) {
                    button.focus();
                }
            });
    }

    /* ---------- Loading cities lazily, one region at a time ---------- */

    function nearestRegion(lat, lon) {
        let best = REGIONS[0];
        let bestDistance = Infinity;
        REGIONS.forEach((region) => {
            const dLon = Math.abs(wrapLon(region.lon - lon));
            const distance = dLon * dLon + (region.lat - lat) * (region.lat - lat);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = region;
            }
        });
        return best;
    }

    // Only the one or two regions nearest the middle of the view load.
    function loadVisibleRegions() {
        const size = canvasSize();
        const cam = camera(size.width, size.height, 1);
        const wanted = REGIONS
            .map((region) => ({ region, point: project(region.lat, region.lon, cam) }))
            .filter((item) => item.point.visible)
            .map((item) => ({
                region: item.region,
                distance: Math.hypot(item.point.x - size.width / 2, item.point.y - size.height / 2),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, MAX_REGIONS_PER_LOOK);

        wanted.forEach(({ region }) => {
            const known = regions[region.id];
            const now = Date.now();
            if (known && (!known.hasPending || now - known.fetchedAt < PENDING_RETRY_MS)) {
                return;
            }
            if (known && known.loading) {
                return;
            }
            regions[region.id] = Object.assign(known || { cities: [] }, { loading: true });
            deps.fetchRegion(region.id)
                .then((data) => {
                    if (!data || !Array.isArray(data.cities)) {
                        throw new Error("No city data");
                    }
                    regions[region.id] = {
                        cities: data.cities,
                        fetchedAt: Date.now(),
                        hasPending: data.cities.some((city) => city.pending),
                        loading: false,
                    };
                    if (regions[region.id].hasPending) {
                        setTimeout(() => {
                            if (isOpen && !animation) {
                                loadVisibleRegions();
                            }
                        }, PENDING_RETRY_MS);
                    }
                    placeMarkersSoon();
                })
                .catch(() => {
                    regions[region.id] = { cities: [], fetchedAt: Date.now(), hasPending: true, loading: false };
                    setStatus("Some cities are still tuning in. Trying again shortly…", { busy: true });
                    setTimeout(() => setStatus(""), 4000);
                });
        });
    }

    /* ---------- Extra cities, a few at a time ---------- */

    function needsWeather(city, now) {
        const known = extras[city.query];
        if (!known) {
            return true;
        }
        if (known.loading) {
            return false;
        }
        if (known.pending) {
            return now - known.triedAt > PENDING_RETRY_MS;
        }
        return now - known.fetchedAt > EXTRA_REFRESH_MS;
    }

    function fetchExtra(city, now) {
        extraFetchTimes.push(now);
        const known = Object.assign(extras[city.query] || {}, city, { loading: true, triedAt: now });
        extras[city.query] = known;
        deps.fetchCity(city.query)
            .then((weather) => {
                Object.assign(known, {
                    pending: false,
                    temperature: weather.temperature,
                    conditionId: weather.conditionId,
                    weatherCode: weather.weatherCode,
                    condition: weather.condition,
                    fetchedAt: Date.now(),
                });
                placeMarkersSoon();
            })
            // a city that didn't load stays "loading" and is tried again later
            .catch((error) => {
                let wait = PENDING_RETRY_MS + 100;
                if (error && error.status === 429) {
                    extrasPausedUntil = Date.now() + MINUTE_MS;
                    wait = MINUTE_MS + 100;
                }
                if (isOpen) {
                    lookAgainIn(wait);
                }
            })
            .finally(() => {
                known.loading = false;
            });
    }

    // Fetches weather for the extra cities on screen that need it, those
    // nearest the middle first, within the per-minute budget. If some are
    // left waiting, it looks again when the budget frees up.
    // Plans another look; if one is already planned sooner, that one stays.
    function lookAgainIn(wait) {
        const due = Date.now() + wait;
        if (extrasTimer !== null && extrasDueAt <= due) {
            return;
        }
        clearTimeout(extrasTimer);
        extrasDueAt = due;
        extrasTimer = setTimeout(() => {
            extrasTimer = null;
            if (isOpen && !animation && zoomTarget === null) {
                loadVisibleExtras();
            }
        }, wait);
    }

    function loadVisibleExtras() {
        clearTimeout(extrasTimer);
        extrasTimer = null;
        const now = Date.now();
        if (now < extrasPausedUntil) {
            lookAgainIn(extrasPausedUntil - now);
            return;
        }
        extraFetchTimes = extraFetchTimes.filter((at) => now - at < MINUTE_MS);
        const size = canvasSize();
        const waiting = citiesOnScreen(extraCities())
            .filter((item) => needsWeather(item.city, now))
            .map((item) => ({
                city: item.city,
                distance: Math.hypot(item.point.x - size.width / 2, item.point.y - size.height / 2),
            }))
            .sort((a, b) => a.distance - b.distance);
        const room = EXTRAS_PER_MINUTE - extraFetchTimes.length;
        waiting.slice(0, Math.max(0, room)).forEach((item) => fetchExtra(item.city, now));
        if (waiting.length > room) {
            // the oldest fetch leaves the one-minute window first
            lookAgainIn(MINUTE_MS - (now - extraFetchTimes[0]) + 100);
        }
        // cities that failed a moment ago are due again a little later
        const failedWaits = citiesOnScreen(extraCities())
            .map((item) => extras[item.city.query])
            .filter((known) => known && known.pending && !known.loading && now - known.triedAt <= PENDING_RETRY_MS)
            .map((known) => known.triedAt + PENDING_RETRY_MS + 100 - now);
        if (failedWaits.length > 0) {
            lookAgainIn(Math.min(...failedWaits));
        }
    }

    /* ---------- Moving the camera ---------- */

    function easeInOut(t) {
        if (t < 0.5) {
            return 2 * t * t;
        }
        return 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Markers only know where cities are when the globe stands still, so
    // they fade out while it moves and come back when it settles.
    function setMoving(moving) {
        byId("screenGlobe").classList.toggle("is-moving", moving);
    }

    // Stops whatever is moving the globe (a glide, a move, a zoom).
    // Returns true if something was moving.
    function stopMotion() {
        const wasMoving = animation !== null || settleTimer !== null;
        if (animation) {
            cancelAnimationFrame(animation);
            // A zoom glide stopped part-way: the level becomes whatever size
            // the globe is drawn at now. A spin or a finished glide leaves the
            // size alone, so the level stays exactly as it was (rounding could
            // otherwise drop 2.5 to 2.4999…, under a tier's threshold).
            const size = canvasSize();
            const shorterSide = Math.min(size.width, size.height);
            if (shorterSide > 0 && view.radius > 0 && Math.abs(view.radius - radiusFor(view.level)) > 0.5) {
                view.level = clampLevel(levelForShare(view.radius / shorterSide));
            }
        }
        animation = null;
        zoomTarget = null;
        clearTimeout(settleTimer);
        settleTimer = null;
        return wasMoving;
    }

    function settle() {
        if (animation) {
            cancelAnimationFrame(animation);
        }
        animation = null;
        zoomTarget = null;
        clearTimeout(settleTimer);
        settleTimer = null;
        if (drawFrame) {
            cancelAnimationFrame(drawFrame);
            drawFrame = null;
        }
        setMoving(false);
        render(1);
        placeMarkers();
        loadVisibleRegions();
        loadVisibleExtras();
        scheduleDetail();
    }

    // Glides to a new look point and zoom level (instantly with reduced motion).
    function moveTo(lat, lon, level) {
        const targetRadius = radiusFor(level);
        const target = {
            lat: clampLat(lat),
            lon: wrapLon(lon),
            radius: targetRadius,
            tilt: tiltFor(level, targetRadius),
        };
        stopMotion();
        view.level = level;
        if (deps.prefersReducedMotion() || view.radius === 0) {
            Object.assign(view, target);
            settle();
            return;
        }
        setMoving(true);
        const start = { lat: view.lat, lon: view.lon, radius: view.radius, tilt: view.tilt };
        const dLon = wrapLon(target.lon - start.lon);
        const duration = deps.frame.cssDuration("--dur-slow") * 1.4;
        const began = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - began) / duration);
            const k = easeInOut(t);
            view.lat = start.lat + (target.lat - start.lat) * k;
            view.lon = wrapLon(start.lon + dLon * k);
            view.radius = start.radius + (target.radius - start.radius) * k;
            view.tilt = start.tilt + (target.tilt - start.tilt) * k;
            if (t < 1) {
                render(0.5);
                animation = requestAnimationFrame(step);
            } else {
                settle();
            }
        };
        animation = requestAnimationFrame(step);
    }

    // The buttons and + / - keys step to the next whole level in or out,
    // even when a pinch left the globe between two levels.
    function zoom(change) {
        let level = Math.ceil(view.level - 0.01) - 1;
        if (change > 0) {
            level = Math.floor(view.level + 0.01) + 1;
        }
        moveTo(view.lat, view.lon, clampLevel(level));
    }

    // Draws one quick frame on the next animation frame, however many
    // finger moves arrive before it.
    function drawSoon() {
        if (!drawFrame) {
            drawFrame = requestAnimationFrame(() => {
                drawFrame = null;
                render(0.5);
            });
        }
    }

    // Sets the zoom level while keeping a place pinned to the screen point
    // (x, y), so the globe grows toward the cursor or between your fingers.
    // place is the lat/lon that should sit at (x, y); by default, whatever
    // is there now. Over the sky there is nothing to pin.
    function zoomAround(level, x, y, place) {
        let pinned = place;
        if (!pinned) {
            pinned = placeAt(x, y);
        }
        view.level = level;
        view.radius = radiusFor(level);
        view.tilt = tiltFor(level, view.radius);
        // A place more than 90 degrees of longitude away is over the pole
        // from the middle; turning toward it would flip the globe around,
        // so the zoom just heads for the middle instead.
        if (!pinned || Math.abs(wrapLon(pinned.lon - view.lon)) > 90) {
            return;
        }
        // turn the globe until the place is back under the point; each
        // correction gets closer, and three are plenty
        for (let i = 0; i < 3; i++) {
            const now = placeAt(x, y);
            if (!now) {
                return;
            }
            // How far the place under the point moves for each degree the view
            // turns north. It is about 1 near the middle, but far south, where
            // the camera can't tilt any further, it can be 2 or 3, so measure it.
            const nudge = 0.01;
            view.lat += nudge;
            const nudged = placeAt(x, y);
            view.lat -= nudge;
            let gain = 1;
            if (nudged) {
                gain = (nudged.lat - now.lat) / nudge;
            }
            // near the disc's side edges the measurement is unreliable, so
            // only trust it when it says the place moves at least 0.6 as fast
            if (gain < 0.6) {
                gain = 1;
            }
            view.lat = clampLat(view.lat + (pinned.lat - now.lat) / gain);
            view.lon = wrapLon(view.lon + wrapLon(pinned.lon - now.lon));
        }
    }

    // Glides the zoom toward level, a little closer every frame, toward the
    // screen point (x, y). Calling it again while it runs just changes where
    // it is heading, so wheel turns add up smoothly. Markers come back once
    // the zoom has rested for a moment.
    function zoomToward(level, x, y) {
        const target = clampLevel(level);
        // a sideways scroll, or scrolling past the last level, changes nothing
        if (zoomTarget === null && target === view.level) {
            return;
        }
        if (zoomTarget === null) {
            stopMotion();
        }
        clearTimeout(settleTimer);
        settleTimer = null;
        zoomTarget = target;
        zoomPoint = { x, y };
        if (animation) {
            return;
        }
        setMoving(true);
        const settings = CirrusConfig.globeZoom;
        let before = performance.now();
        const step = (now) => {
            // a frame's time stamp can be a little earlier than the clock
            // reading taken when it was asked for, so never go backwards
            const elapsed = Math.max(0, now - before);
            before = now;
            const gap = zoomTarget - view.level;
            // the share of the gap to close this frame, the same on any screen
            const follow = 1 - Math.pow(1 - settings.followPerFrame, elapsed / (1000 / 60));
            let next = clampLevel(view.level + gap * follow);
            if (Math.abs(gap) < settings.closeEnough || deps.prefersReducedMotion()) {
                next = zoomTarget;
            }
            zoomAround(next, zoomPoint.x, zoomPoint.y);
            render(0.5);
            if (next === zoomTarget) {
                animation = null;
                settleTimer = setTimeout(settle, settings.settleMs);
                return;
            }
            animation = requestAnimationFrame(step);
        };
        animation = requestAnimationFrame(step);
    }

    function rotate(degrees) {
        moveTo(view.lat, view.lon + degrees, view.level);
    }

    function next() {
        regionIndex = (regionIndex + 1) % REGIONS.length;
        const region = REGIONS[regionIndex];
        moveTo(region.lat, region.lon, Math.max(view.level, 1));
        byId("globeNext").setAttribute("aria-label", "Next region (now " + region.name + ")");
    }

    function restore() {
        moveTo(home.lat, home.lon, DEFAULT_LEVEL);
    }

    // busy shows the little bouncing dots beside the text
    function setStatus(text, { busy = false } = {}) {
        const status = byId("globeStatus");
        byId("globeStatusText").textContent = text;
        status.classList.toggle("is-busy", busy);
        status.classList.toggle("hidden", !text);
    }

    /* ---------- Drag to spin, keys to steer ---------- */

    // After a drag the globe keeps turning at the speed you let go of it,
    // slowing a little every frame until it stops.
    function glide(velocity) {
        // a zoom still waiting to settle must not cut the glide short
        stopMotion();
        const settings = CirrusConfig.globeGlide;
        let speedLon = Math.max(-settings.maxDegPerMs, Math.min(settings.maxDegPerMs, velocity.lon));
        let speedLat = Math.max(-settings.maxDegPerMs, Math.min(settings.maxDegPerMs, velocity.lat));
        let before = performance.now();
        setMoving(true);
        const step = (now) => {
            // a frame's time stamp can be a little earlier than the clock
            // reading taken when it was asked for, so never go backwards
            const elapsed = Math.max(0, now - before);
            before = now;
            view.lon = wrapLon(view.lon + speedLon * elapsed);
            view.lat = clampLat(view.lat + speedLat * elapsed);
            // friction is per 60fps frame, so it slows the same on any screen
            const slowdown = Math.pow(settings.frictionPerFrame, elapsed / (1000 / 60));
            speedLon *= slowdown;
            speedLat *= slowdown;
            if (Math.hypot(speedLon, speedLat) < settings.stopBelowDegPerMs) {
                settle();
                return;
            }
            render(0.5);
            animation = requestAnimationFrame(step);
        };
        animation = requestAnimationFrame(step);
    }

    // A pointer's spot on the canvas, in the canvas's own CSS pixels.
    function canvasPoint(event) {
        const rect = byId("globeCanvas").getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    // Fingers and the cursor count when they are on the globe itself or on
    // a city marker, not on the buttons around it.
    function isOnGlobe(target) {
        if (!target || !target.closest) {
            return false;
        }
        return target === byId("globeCanvas") || Boolean(target.closest(".globe-marker"));
    }

    // Scroll to zoom toward the cursor. A trackpad pinch arrives as a
    // scroll with the ctrl key held, in much smaller steps.
    function onWheel(event) {
        if (!isOpen || !isOnGlobe(event.target)) {
            return;
        }
        event.preventDefault();
        const settings = CirrusConfig.globeZoom;
        let pixels = event.deltaY;
        if (event.deltaMode === 1) {
            pixels *= CirrusConfig.viewWheel.lineHeightPx;
        } else if (event.deltaMode === 2) {
            pixels *= canvasSize().height;
        }
        let levelsPerPixel = settings.levelsPerWheelPx;
        if (event.ctrlKey) {
            levelsPerPixel = settings.levelsPerPinchPx;
        }
        // turns made while it is still zooming add on to where it is heading
        let from = view.level;
        if (zoomTarget !== null) {
            from = zoomTarget;
        }
        const point = canvasPoint(event);
        zoomToward(from - pixels * levelsPerPixel, point.x, point.y);
    }

    // One finger (or the mouse) drags the globe around; two fingers pinch
    // to zoom and move it together; a quick double tap zooms in one level
    // toward the spot you tapped. The listeners sit on the whole screen so
    // a pinch still works when a finger lands on a city marker.
    function wirePointers() {
        const screen = byId("screenGlobe");
        const canvas = byId("globeCanvas");
        const settings = CirrusConfig.globeZoom;
        // every finger (or the mouse) touching the canvas, by pointer id
        const pointers = new Map();
        let last = null;
        let pinch = null;
        let lastTap = null;
        // how fast the globe was turning, in degrees per millisecond
        let velocity = { lon: 0, lat: 0 };

        function fingersApart() {
            const [a, b] = [...pointers.values()];
            return {
                distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            };
        }

        function startPinch() {
            last = null;
            const fingers = fingersApart();
            pinch = {
                distance: fingers.distance,
                share: shareFor(view.level),
                // the place between the fingers stays between them
                place: placeAt(fingers.middle.x, fingers.middle.y),
            };
            setMoving(true);
        }

        // Two quick taps close together zoom in toward the second one.
        function checkDoubleTap(event, point) {
            const tap = { x: point.x, y: point.y, time: event.timeStamp };
            if (lastTap && tap.time - lastTap.time < settings.doubleTapMs
                && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < settings.doubleTapSlopPx) {
                lastTap = null;
                zoomToward(view.level + 1, tap.x, tap.y);
                return;
            }
            lastTap = tap;
        }

        screen.addEventListener("pointerdown", (event) => {
            if (!isOnGlobe(event.target)) {
                return;
            }
            pointers.set(event.pointerId, canvasPoint(event));
            if (pointers.size === 2) {
                stopMotion();
                startPinch();
                return;
            }
            if (pointers.size > 2) {
                return;
            }
            // A press on a marker stays a click unless it turns into a drag.
            // Either way the press is captured, so its release is heard even
            // if the pointer has wandered off the globe.
            const onMarker = event.target !== canvas;
            if (onMarker) {
                event.target.closest(".globe-marker").setPointerCapture(event.pointerId);
            } else {
                canvas.setPointerCapture(event.pointerId);
            }
            // grabbing a moving globe stops it
            const interrupted = stopMotion();
            const point = canvasPoint(event);
            last = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
                downAt: event.timeStamp,
                start: point,
                moved: false,
                onMarker,
                interrupted,
            };
            velocity = { lon: 0, lat: 0 };
        });
        screen.addEventListener("pointermove", (event) => {
            if (!pointers.has(event.pointerId)) {
                return;
            }
            // a mouse that moves with no button held let go somewhere we missed
            if (event.pointerType === "mouse" && event.buttons === 0) {
                end(event);
                return;
            }
            pointers.set(event.pointerId, canvasPoint(event));
            if (pinch) {
                // once a finger has lifted, the pinch is over until all lift
                if (pointers.size < 2 || pinch.ended) {
                    return;
                }
                const fingers = fingersApart();
                const level = clampLevel(levelForShare(pinch.share * fingers.distance / pinch.distance));
                zoomAround(level, fingers.middle.x, fingers.middle.y, pinch.place);
                drawSoon();
                return;
            }
            if (!last || animation) {
                return;
            }
            // The globe only starts turning once the pointer has moved more
            // than a tap's worth, so a slightly shaky tap stays a tap.
            const point = canvasPoint(event);
            if (!last.moved && Math.hypot(point.x - last.start.x, point.y - last.start.y) > settings.tapSlopPx) {
                last.moved = true;
                // a drag that began on a marker takes over from its click
                if (last.onMarker) {
                    canvas.setPointerCapture(event.pointerId);
                }
            }
            if (!last.moved) {
                return;
            }
            const dx = event.clientX - last.x;
            const dy = event.clientY - last.y;
            const now = performance.now();
            const elapsed = Math.max(1, now - last.time);
            last.x = event.clientX;
            last.y = event.clientY;
            last.time = now;
            const cosLat = Math.max(0.2, Math.cos(view.lat * DEG));
            const dLon = -dx / view.radius / DEG / cosLat;
            const dLat = dy / view.radius / DEG;
            view.lon = wrapLon(view.lon + dLon);
            view.lat = clampLat(view.lat + dLat);
            velocity = { lon: dLon / elapsed, lat: dLat / elapsed };
            setMoving(true);
            render(0.5);
        });
        const end = (event) => {
            if (!pointers.delete(event.pointerId)) {
                return;
            }
            if (pinch) {
                // lifting a finger ends the pinch; the other finger does
                // nothing until it lifts too
                if (!pinch.ended) {
                    pinch.ended = true;
                    settle();
                }
                if (pointers.size === 0) {
                    pinch = null;
                }
                lastTap = null;
                return;
            }
            if (!last) {
                return;
            }
            const drag = last;
            last = null;
            // a tap on a marker is its click, which opens the city
            if (drag.onMarker && !drag.moved) {
                lastTap = null;
                return;
            }
            // a tap: nothing moved, so there is nothing to redraw
            const quick = event.timeStamp - drag.downAt < settings.tapMaxMs;
            if (!drag.moved && quick && event.type === "pointerup") {
                if (drag.interrupted) {
                    settle();
                }
                checkDoubleTap(event, canvasPoint(event));
                return;
            }
            lastTap = null;
            // a pause before letting go means the globe should stay put
            const stillFor = performance.now() - drag.time;
            const speed = Math.hypot(velocity.lon, velocity.lat);
            if (deps.prefersReducedMotion() || stillFor > 80 || speed < CirrusConfig.globeGlide.stopBelowDegPerMs) {
                settle();
                return;
            }
            glide(velocity);
        };
        // releases are heard anywhere in the window; end() ignores pointers
        // that never pressed on the globe
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        screen.addEventListener("wheel", onWheel, { passive: false });
    }

    function onKeydown(event) {
        if (!isOpen) {
            return;
        }
        if (event.key === "ArrowLeft") {
            rotate(-ROTATE_STEP);
        } else if (event.key === "ArrowRight") {
            rotate(ROTATE_STEP);
        } else if (event.key === "ArrowUp") {
            moveTo(view.lat + PAN_STEP, view.lon, view.level);
        } else if (event.key === "ArrowDown") {
            moveTo(view.lat - PAN_STEP, view.lon, view.level);
        } else if (event.key === "+" || event.key === "=") {
            zoom(1);
        } else if (event.key === "-" || event.key === "_") {
            zoom(-1);
        } else {
            return;
        }
        event.preventDefault();
    }

    /* ---------- Idle: the globe turns by itself ---------- */

    // Attract mode turns the globe slowly east until any input stops it.
    // It draws at a gentle frame rate to spare the battery.
    function startDrift() {
        if (!isOpen || animation) {
            return;
        }
        const settings = CirrusConfig.idle;
        let before = performance.now();
        let drawnAt = 0;
        setMoving(true);
        const step = (now) => {
            view.lon = wrapLon(view.lon + settings.globeDegPerSecond * (now - before) / 1000);
            before = now;
            if (now - drawnAt >= 1000 / settings.globeFps) {
                drawnAt = now;
                render(0.5);
            }
            animation = requestAnimationFrame(step);
        };
        animation = requestAnimationFrame(step);
    }

    function stopDrift() {
        if (!animation) {
            return;
        }
        cancelAnimationFrame(animation);
        settle();
    }

    /* ---------- Open / close ---------- */

    // options: { lat, lon } of the city to start over; keepCamera to come back
    function open(options = {}) {
        if (options.lat !== undefined && options.lon !== undefined) {
            home = { lat: options.lat, lon: options.lon };
        }
        const startRegion = nearestRegion(home.lat, home.lon);
        regionIndex = REGIONS.indexOf(startRegion);

        isOpen = true;
        if (gpu === undefined) {
            gpu = null;
            if (typeof CirrusGlobeGL !== "undefined") {
                gpu = CirrusGlobeGL.create(byId("globeCanvas"));
            }
            if (gpu) {
                gpu.whenRestored(() => render(1));
            }
        }
        deps.frame.openScreen("globe", { title: "Globe", onClose: onScreenClose });
        byId("frame").dataset.mode = "globe";
        document.addEventListener("keydown", onKeydown);
        window.addEventListener("resize", onResize);

        if (options.keepCamera && view.radius > 0) {
            view.radius = radiusFor(view.level);
            view.tilt = tiltFor(view.level, view.radius);
            settle();
        } else {
            view.radius = 0;
            moveTo(home.lat, home.lon, DEFAULT_LEVEL);
        }
        loadBase();
        byId("globeNext").focus();
    }

    function onResize() {
        if (!isOpen) {
            return;
        }
        view.radius = radiusFor(view.level);
        view.tilt = tiltFor(view.level, view.radius);
        render(1);
        placeMarkers();
    }

    function onScreenClose() {
        isOpen = false;
        delete byId("frame").dataset.mode;
        document.removeEventListener("keydown", onKeydown);
        window.removeEventListener("resize", onResize);
        stopMotion();
        clearTimeout(extrasTimer);
        extrasTimer = null;
        clearTimeout(markersTimer);
        deps.onEnd();
    }

    // Leaves the globe for a city's forecast without counting as "End".
    function closeForVisit() {
        const onEnd = deps.onEnd;
        deps.onEnd = () => {};
        deps.frame.closeScreen();
        deps.onEnd = onEnd;
    }

    function init(dependencies) {
        deps = Object.assign(deps, dependencies);
        byId("globeZoomOut").addEventListener("click", () => zoom(-1));
        byId("globeZoomIn").addEventListener("click", () => zoom(1));
        byId("globeNext").addEventListener("click", next);
        byId("globeRotateLeft").addEventListener("click", () => rotate(-ROTATE_STEP));
        byId("globeRotateRight").addEventListener("click", () => rotate(ROTATE_STEP));
        byId("globeRestore").addEventListener("click", restore);
        byId("globeEnd").addEventListener("click", () => deps.frame.back());
        wirePointers();
        deps.frame.setHandlers({ onGlobe: () => deps.onOpen() });
    }

    return {
        init,
        open,
        closeForVisit,
        isOpen: () => isOpen,
        startDrift,
        stopDrift,
        project,
        nearestRegion,
        shareFor,
        levelForShare,
    };
})();
