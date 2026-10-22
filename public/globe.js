/* Globe: a satellite globe drawn on a <canvas> from one NASA GIBS
   Blue Marble image, with live weather markers for a fixed list of major
   cities. No library — just the orthographic projection:

   Forward (lat/lon -> screen), with the globe facing point (lat0, lon0):
     cos c = sin(lat0) sin(lat) + cos(lat0) cos(lat) cos(lon - lon0)   (> 0 means visible)
     x = cos(lat) sin(lon - lon0)
     y = cos(lat0) sin(lat) - sin(lat0) cos(lat) cos(lon - lon0)
   Inverse (screen -> lat/lon), for a point (x, y) on the unit disc with z = sqrt(1 - x^2 - y^2):
     lat = asin(z sin(lat0) + y cos(lat0))
     lon = lon0 + atan2(x, z cos(lat0) - y sin(lat0))

   Zooming in tilts the view: the facing point slides south of the spot
   you are looking at and the disc slides down, so the horizon curves
   across the top of the panel like the references. */

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
    const ZOOM_LEVELS = [0.42, 0.8, 1.35, 2.2, 3.4];
    const DEFAULT_LEVEL = 2;
    const DETAIL_LEVEL = 2;
    const ROTATE_STEP = 20;
    const PAN_STEP = 10;
    const MAX_TILT = 58 * DEG;
    const HORIZON_SHARE = 0.36;
    const MAX_REGIONS_PER_LOOK = 2;
    const PENDING_RETRY_MS = 20000;
    const BASE_SIZE = { width: 2048, height: 1024 };
    const DETAIL_SPAN = { lon: 90, lat: 60 };
    const DETAIL_SIZE = { width: 2048, height: 1366 };

    let deps = {
        frame: null,
        fetchRegion: async () => null,
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
    let detail = null;
    let detailTimer = null;
    let animation = null;
    let isOpen = false;
    const regions = {};

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

    // Radius in CSS pixels for a zoom level.
    function radiusFor(level) {
        const size = canvasSize();
        return ZOOM_LEVELS[level] * Math.min(size.width, size.height);
    }

    // How far to tilt so the horizon sits near the top of the panel.
    function tiltFor(level, radius) {
        if (level === 0) {
            return 0;
        }
        const height = canvasSize().height;
        const sinTilt = Math.min(Math.max(1 - (HORIZON_SHARE * height) / radius, 0), Math.sin(MAX_TILT));
        return Math.asin(sinTilt);
    }

    function wrapLon(lon) {
        return ((lon + 540) % 360) - 180;
    }

    function clampLat(lat) {
        return Math.max(-75, Math.min(75, lat));
    }

    // Where the camera is for the current view (all in CSS pixels).
    function camera(width, height, scale) {
        const radius = view.radius * scale;
        const lat0 = Math.max(-89.9, Math.min(89.9, view.lat - view.tilt / DEG));
        return {
            radius,
            cx: width / 2,
            cy: height / 2 + radius * Math.sin(view.tilt),
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

    // Loads an equirectangular image into raw pixels we can sample.
    function loadTexture(url, bounds) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve({
                    width: canvas.width,
                    height: canvas.height,
                    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
                    minLon: bounds.minLon,
                    minLat: bounds.minLat,
                    maxLon: bounds.maxLon,
                    maxLat: bounds.maxLat,
                });
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
        loadTexture(gibsUrl(-180, -90, 180, 90, BASE_SIZE), bounds)
            .then((texture) => {
                base = texture;
                setStatus("");
                render(1);
            })
            .catch(() => setStatus("The satellite view isn't available right now."));
    }

    // A sharper image of the area in view once you zoom in.
    function scheduleDetail() {
        clearTimeout(detailTimer);
        if (view.level < DETAIL_LEVEL) {
            return;
        }
        detailTimer = setTimeout(() => {
            const minLon = Math.max(-180, view.lon - DETAIL_SPAN.lon / 2);
            const maxLon = Math.min(180, view.lon + DETAIL_SPAN.lon / 2);
            const minLat = Math.max(-90, view.lat - DETAIL_SPAN.lat / 2);
            const maxLat = Math.min(90, view.lat + DETAIL_SPAN.lat / 2);
            if (detail && view.lon > detail.minLon + 15 && view.lon < detail.maxLon - 15
                && view.lat > detail.minLat + 10 && view.lat < detail.maxLat - 10) {
                return;
            }
            const bounds = { minLon, minLat, maxLon, maxLat };
            loadTexture(gibsUrl(minLon, minLat, maxLon, maxLat, DETAIL_SIZE), bounds)
                .then((texture) => {
                    detail = texture;
                    if (isOpen && !animation) {
                        render(1);
                    }
                })
                .catch(() => {});
        }, 400);
    }

    /* ---------- Drawing ---------- */

    function render(scale) {
        const canvas = byId("globeCanvas");
        const size = canvasSize();
        if (!size.width || !size.height) {
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
                let tex = base;
                if (detail && lat >= detail.minLat && lat <= detail.maxLat
                    && lon >= detail.minLon && lon <= detail.maxLon) {
                    tex = detail;
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

        placeMarkers();
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
            "Satellite globe centred on " + nearest.name + ", zoom level " + (view.level + 1) + " of " + ZOOM_LEVELS.length);
    }

    /* ---------- Markers ---------- */

    function markerLabel(city) {
        if (city.pending) {
            return city.name;
        }
        return city.name + " " + deps.formatTemp(city.temperature);
    }

    function placeMarkers() {
        const layer = byId("globeMarkers");
        const size = canvasSize();
        const cam = camera(size.width, size.height, 1);
        const placed = [];
        const cities = [];
        Object.values(regions).forEach((region) => region.cities.forEach((city) => cities.push(city)));

        layer.replaceChildren();
        cities
            .map((city) => ({ city, point: project(city.lat, city.lon, cam) }))
            .filter((item) => item.point.visible
                && item.point.x > 0 && item.point.x < size.width
                && item.point.y > 0 && item.point.y < size.height)
            .sort((a, b) => b.point.depth - a.point.depth)
            .forEach(({ city, point }) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "globe-marker";
                if (city.pending) {
                    button.classList.add("is-pending");
                }
                button.style.left = point.x + "px";
                button.style.top = point.y + "px";
                // near the right edge the label goes on the left of its dot
                if (point.x > size.width * 0.62) {
                    button.classList.add("is-flipped");
                }

                const dot = document.createElement("span");
                dot.className = "globe-dot";
                button.appendChild(dot);

                if (!city.pending) {
                    const icon = document.createElement("img");
                    icon.className = "globe-marker-icon";
                    icon.src = deps.iconPath(city.conditionId, city.weatherCode);
                    icon.alt = "";
                    button.appendChild(icon);
                }

                const label = document.createElement("span");
                label.className = "globe-label";
                label.textContent = markerLabel(city);
                button.appendChild(label);

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

                let description = city.name;
                if (city.pending) {
                    description += ": weather loading";
                } else {
                    description += ": " + deps.formatTemp(city.temperature) + ", " + (city.condition || "");
                }
                button.setAttribute("aria-label", description + ". Open forecast");
                button.addEventListener("click", () => deps.onVisit(city.name));
                layer.appendChild(button);
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
                    if (isOpen && !animation) {
                        placeMarkers();
                    }
                })
                .catch(() => {
                    regions[region.id] = { cities: [], fetchedAt: Date.now(), hasPending: true, loading: false };
                    setStatus("Some cities are still tuning in. Trying again shortly…", { busy: true });
                    setTimeout(() => setStatus(""), 4000);
                });
        });
    }

    /* ---------- Moving the camera ---------- */

    function easeInOut(t) {
        if (t < 0.5) {
            return 2 * t * t;
        }
        return 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function settle() {
        animation = null;
        render(1);
        loadVisibleRegions();
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
        view.level = level;
        if (animation) {
            cancelAnimationFrame(animation);
            animation = null;
        }
        if (deps.prefersReducedMotion() || view.radius === 0) {
            Object.assign(view, target);
            settle();
            return;
        }
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

    function zoom(change) {
        const level = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, view.level + change));
        moveTo(view.lat, view.lon, level);
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
        const settings = CirrusConfig.globeGlide;
        let speedLon = Math.max(-settings.maxDegPerMs, Math.min(settings.maxDegPerMs, velocity.lon));
        let speedLat = Math.max(-settings.maxDegPerMs, Math.min(settings.maxDegPerMs, velocity.lat));
        let before = performance.now();
        const step = (now) => {
            const elapsed = now - before;
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

    function wireDrag() {
        const canvas = byId("globeCanvas");
        let last = null;
        // how fast the globe was turning, in degrees per millisecond
        let velocity = { lon: 0, lat: 0 };
        canvas.addEventListener("pointerdown", (event) => {
            // grabbing a gliding globe stops it
            if (animation) {
                cancelAnimationFrame(animation);
                animation = null;
            }
            last = { x: event.clientX, y: event.clientY, time: performance.now() };
            velocity = { lon: 0, lat: 0 };
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener("pointermove", (event) => {
            if (!last || animation) {
                return;
            }
            const dx = event.clientX - last.x;
            const dy = event.clientY - last.y;
            const now = performance.now();
            const elapsed = Math.max(1, now - last.time);
            last = { x: event.clientX, y: event.clientY, time: now };
            const cosLat = Math.max(0.2, Math.cos(view.lat * DEG));
            const dLon = -dx / view.radius / DEG / cosLat;
            const dLat = dy / view.radius / DEG;
            view.lon = wrapLon(view.lon + dLon);
            view.lat = clampLat(view.lat + dLat);
            velocity = { lon: dLon / elapsed, lat: dLat / elapsed };
            render(0.5);
        });
        const end = () => {
            if (!last) {
                return;
            }
            // a pause before letting go means the globe should stay put
            const stillFor = performance.now() - last.time;
            last = null;
            const speed = Math.hypot(velocity.lon, velocity.lat);
            if (deps.prefersReducedMotion() || stillFor > 80 || speed < CirrusConfig.globeGlide.stopBelowDegPerMs) {
                settle();
                return;
            }
            glide(velocity);
        };
        canvas.addEventListener("pointerup", end);
        canvas.addEventListener("pointercancel", end);
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

    /* ---------- Open / close ---------- */

    // options: { lat, lon } of the city to start over; keepCamera to come back
    function open(options = {}) {
        if (options.lat !== undefined && options.lon !== undefined) {
            home = { lat: options.lat, lon: options.lon };
        }
        const startRegion = nearestRegion(home.lat, home.lon);
        regionIndex = REGIONS.indexOf(startRegion);

        isOpen = true;
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
    }

    function onScreenClose() {
        isOpen = false;
        delete byId("frame").dataset.mode;
        document.removeEventListener("keydown", onKeydown);
        window.removeEventListener("resize", onResize);
        if (animation) {
            cancelAnimationFrame(animation);
            animation = null;
        }
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
        wireDrag();
        deps.frame.setHandlers({ onGlobe: () => deps.onOpen() });
    }

    return {
        init,
        open,
        closeForVisit,
        isOpen: () => isOpen,
        project,
        nearestRegion,
    };
})();
