import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";

/*
 * ============================================================
 * TAYEB GO MAP (Leaflet + OpenStreetMap)
 * ============================================================
 *
 * One map for the customer and the driver:
 *   - a pin fixed in the middle of the visible map: the
 *     person moves the map under it to choose a place (pick);
 *   - pickup (A) and drop-off (B), the route between them;
 *   - anonymous cars nearby, seen from above, turned the way
 *     they drive;
 *   - the assigned driver, gliding to each new position;
 *   - the driver's own position (self) with its direction;
 *   - a radar pulse while Tayeb looks for a driver.
 *
 * props:
 *   center        first view { lat, lng }
 *   pick          "pickup" | "dropoff" | null
 *   onPick        (point) after the map stops moving in pick mode
 *   onPickMove    () when the map starts moving in pick mode
 *   pickup, dropoff, line, cars, driver, self, radar
 *   focus         { lat, lng, zoom, key }: go there (key changes)
 *   fitKey        change to frame everything again
 *   fitPoints     frame only these points ([{ lat, lng }]) when given
 *   padding       { top, right, bottom, left } px kept clear of panels
 */

const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATTRIBUTION =
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const ORANGE = "#f97316";
const INK = "#0b1220";

/* ---------- vehicles seen from above ---------- */

function vehicleSvg(cls, size = 1) {
    if (cls === "MOTO") {
        return `<svg viewBox="0 0 14 30" width="${10 * size}" height="${22 * size}" aria-hidden="true"><rect x="5" y="0.5" width="4" height="6" rx="2" fill="${INK}"/><rect x="2.5" y="6" width="9" height="16" rx="4.5" fill="${ORANGE}" stroke="white" stroke-width="1.4"/><circle cx="7" cy="13" r="3" fill="${INK}"/><rect x="5" y="22.5" width="4" height="7" rx="2" fill="${INK}"/></svg>`;
    }

    if (cls === "TRUCK" || cls === "VAN") {
        const long = cls === "TRUCK";

        return `<svg viewBox="0 0 24 ${long ? 52 : 42}" width="${16 * size}" height="${(long ? 35 : 28) * size}" aria-hidden="true"><rect x="2" y="1" width="20" height="12" rx="4" fill="white" stroke="${INK}" stroke-opacity=".25"/><rect x="5" y="4" width="14" height="5" rx="1.5" fill="${INK}" opacity=".8"/><rect x="1.5" y="14" width="21" height="${long ? 37 : 27}" rx="2.5" fill="${ORANGE}" stroke="white" stroke-width="1.2"/></svg>`;
    }

    // Pick-up and tricycle: a cab with an open back.
    return `<svg viewBox="0 0 24 40" width="${16 * size}" height="${27 * size}" aria-hidden="true"><rect x="2" y="1" width="20" height="38" rx="7" fill="white" stroke="${INK}" stroke-opacity=".25"/><rect x="5" y="6" width="14" height="7" rx="2.5" fill="${INK}" opacity=".8"/><rect x="5" y="20" width="14" height="15" rx="2" fill="${ORANGE}" opacity=".9"/></svg>`;
}

const ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5 19.5 20.5 12 16.6 4.5 20.5Z" fill="white"/></svg>';

export default function GoMap({
    center,
    pick = null,
    onPick,
    onPickMove,
    pickup = null,
    dropoff = null,
    line = null,
    cars = [],
    driver = null,
    self = null,
    radar = null,
    focus = null,
    fitKey = 0,
    fitPoints = null,
    padding = {},
    className = "",
    label = "Map",
}) {
    const box = useRef(null);

    const kit = useRef(null);

    const [ready, setReady] = useState(false);

    // Latest values for handlers that live as long as the map.
    const live = useRef({ pick, onPick, onPickMove, padding });

    useEffect(() => {
        live.current = { pick, onPick, onPickMove, padding };
    });

    /* ---------------- where the pin's tip is (px) ---------------- */

    function pinPoint(map) {
        const size = map.getSize();
        const room = live.current.padding || {};

        const left = room.left || 0;
        const right = room.right || 0;
        const top = room.top || 0;
        const bottom = room.bottom || 0;

        return {
            x: left + Math.max(0, size.x - left - right) / 2,
            y: top + Math.max(0, size.y - top - bottom) / 2,
        };
    }

    // Moves the map so `point` sits under the pin.
    function showUnderPin(L, map, point, zoom, animate = true) {
        const size = map.getSize();
        const pin = pinPoint(map);

        const targetZoom = zoom ?? map.getZoom();

        const projected = map.project([point.lat, point.lng], targetZoom);

        const centerPoint = projected.add(L.point(size.x / 2 - pin.x, size.y / 2 - pin.y));

        map.setView(map.unproject(centerPoint, targetZoom), targetZoom, { animate });
    }

    /* ---------------- create the map once ---------------- */

    useEffect(() => {
        let cancelled = false;

        import("leaflet").then((module) => {
            if (cancelled || !box.current) {
                return;
            }

            const L = module.default || module;

            const start = center || { lat: 4.0511, lng: 9.7679 };

            const map = L.map(box.current, {
                zoomControl: false,
                attributionControl: true,
                zoomSnap: 0.25,
                inertia: true,
            }).setView([start.lat, start.lng], 15);

            map.attributionControl.setPrefix(false);

            L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

            map.on("movestart", () => {
                if (live.current.pick) {
                    live.current.onPickMove?.();
                }
            });

            map.on("moveend", () => {
                if (!live.current.pick || kit.current?.quiet) {
                    return;
                }

                const pin = pinPoint(map);

                const at = map.containerPointToLatLng([pin.x, pin.y]);

                live.current.onPick?.({ lat: Math.round(at.lat * 1e6) / 1e6, lng: Math.round(at.lng * 1e6) / 1e6 });
            });

            kit.current = { L, map, layers: {}, cars: [], driverAt: null, frame: null, quiet: false };

            setReady(true);
        });

        return () => {
            cancelled = true;

            if (kit.current) {
                cancelAnimationFrame(kit.current.frame);
                kit.current.map.remove();
                kit.current = null;
            }
        };
        // The map is created once; later props update it below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------------- pickup, drop-off and the road ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map, layers } = kit.current;

        function pin(key, place, letter, tone, hidden) {
            if (!place || hidden) {
                if (layers[key]) {
                    layers[key].remove();
                    delete layers[key];
                }

                return;
            }

            if (!layers[key]) {
                layers[key] = L.marker([place.lat, place.lng], {
                    icon: L.divIcon({
                        className: "",
                        html: `<div class="tk-pin is-${tone}"><b>${letter}</b></div>`,
                        iconSize: [34, 34],
                        iconAnchor: [17, 17],
                    }),
                    keyboard: false,
                    interactive: false,
                    zIndexOffset: 500,
                }).addTo(map);
            } else {
                layers[key].setLatLng([place.lat, place.lng]);
            }
        }

        pin("pickup", pickup, "A", "from", pick === "pickup");
        pin("dropoff", dropoff, "B", "to", pick === "dropoff");

        const showRoad = pickup && dropoff && !pick;

        const road = showRoad && line && line.length > 1 ? line : [];

        const straight = showRoad && road.length === 0 ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]] : [];

        if (!layers.casing) {
            layers.casing = L.polyline(road, { color: "white", weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
            layers.road = L.polyline(road, { color: ORANGE, weight: 5.5, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
            layers.straight = L.polyline(straight, { color: INK, weight: 3.5, opacity: 0.55, dashArray: "2 10", lineCap: "round", interactive: false }).addTo(map);
        } else {
            layers.casing.setLatLngs(road);
            layers.road.setLatLngs(road);
            layers.straight.setLatLngs(straight);
        }
    }, [ready, pickup, dropoff, line, pick]);

    /* ---------------- cars nearby ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map } = kit.current;

        const markers = kit.current.cars;

        cars.forEach((car, index) => {
            const html = `<div class="go-car" style="transform:rotate(${Number(car.heading) || 0}deg)">${vehicleSvg(car.cls)}</div>`;

            if (!markers[index]) {
                markers[index] = L.marker([car.lat, car.lng], {
                    icon: L.divIcon({ className: "", html, iconSize: [30, 36], iconAnchor: [15, 18] }),
                    keyboard: false,
                    interactive: false,
                }).addTo(map);
            } else {
                markers[index].setLatLng([car.lat, car.lng]);
                markers[index].setIcon(L.divIcon({ className: "", html, iconSize: [30, 36], iconAnchor: [15, 18] }));
            }
        });

        while (markers.length > cars.length) {
            markers.pop().remove();
        }
    }, [ready, cars]);

    /* ---------------- the assigned driver ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map, layers } = kit.current;

        if (!driver) {
            if (layers.driver) {
                layers.driver.remove();
                delete layers.driver;
                kit.current.driverAt = null;
            }

            return;
        }

        const goal = [driver.lat, driver.lng];

        const html = `<div class="go-driver"><span class="go-driver-halo"></span><span class="go-driver-car" style="transform:rotate(${Number(driver.heading) || 0}deg)">${vehicleSvg(driver.cls, 1.35)}</span></div>`;

        if (!layers.driver) {
            layers.driver = L.marker(goal, {
                icon: L.divIcon({ className: "", html, iconSize: [56, 56], iconAnchor: [28, 28] }),
                keyboard: false,
                interactive: false,
                zIndexOffset: 1000,
            }).addTo(map);

            kit.current.driverAt = goal;

            return;
        }

        layers.driver.setIcon(L.divIcon({ className: "", html, iconSize: [56, 56], iconAnchor: [28, 28] }));

        // Glide from where the car was to where it is now.
        const from = kit.current.driverAt || goal;
        const began = performance.now();

        cancelAnimationFrame(kit.current.frame);

        const step = (now) => {
            if (!kit.current || !layers.driver) {
                return;
            }

            const share = Math.min(1, (now - began) / 1400);
            const eased = 1 - (1 - share) ** 3;
            const here = [from[0] + (goal[0] - from[0]) * eased, from[1] + (goal[1] - from[1]) * eased];

            layers.driver.setLatLng(here);
            kit.current.driverAt = here;

            if (share < 1) {
                kit.current.frame = requestAnimationFrame(step);
            }
        };

        kit.current.frame = requestAnimationFrame(step);
    }, [ready, driver]);

    /* ---------------- my own position (driver) ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map, layers } = kit.current;

        if (!self) {
            if (layers.self) {
                layers.self.remove();
                layers.selfRing.remove();
                delete layers.self;
                delete layers.selfRing;
            }

            return;
        }

        const at = [self.lat, self.lng];

        const moving = self.heading !== null && self.heading !== undefined;

        const html = `<div class="tk-truck ${moving ? "" : "is-still"}"><span class="tk-truck-halo"></span><span class="tk-truck-arrow" style="transform:rotate(${Number(self.heading) || 0}deg)">${ARROW}</span></div>`;

        if (!layers.self) {
            layers.selfRing = L.circle(at, { radius: Math.max(5, Number(self.accuracy) || 0), color: ORANGE, weight: 1, opacity: 0.45, fillColor: ORANGE, fillOpacity: 0.07, interactive: false }).addTo(map);
            layers.self = L.marker(at, { icon: L.divIcon({ className: "", html, iconSize: [48, 48], iconAnchor: [24, 24] }), keyboard: false, interactive: false, zIndexOffset: 900 }).addTo(map);
        } else {
            layers.self.setLatLng(at);
            layers.self.setIcon(L.divIcon({ className: "", html, iconSize: [48, 48], iconAnchor: [24, 24] }));
            layers.selfRing.setLatLng(at);
            layers.selfRing.setRadius(Math.max(5, Number(self.accuracy) || 0));
        }
    }, [ready, self]);

    /* ---------------- radar while searching ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map, layers } = kit.current;

        if (!radar) {
            if (layers.radar) {
                layers.radar.remove();
                delete layers.radar;
            }

            return;
        }

        if (!layers.radar) {
            layers.radar = L.marker([radar.lat, radar.lng], {
                icon: L.divIcon({ className: "", html: '<div class="go-radar"><i></i><i></i><i></i></div>', iconSize: [0, 0], iconAnchor: [0, 0] }),
                keyboard: false,
                interactive: false,
                zIndexOffset: -100,
            }).addTo(map);
        } else {
            layers.radar.setLatLng([radar.lat, radar.lng]);
        }
    }, [ready, radar]);

    /* ---------------- go to a place ---------------- */

    const focusKey = focus?.key;

    useEffect(() => {
        if (!ready || !kit.current || !focus) {
            return;
        }

        const { L, map } = kit.current;

        // Moving the map ourselves isn't the person choosing a place…
        kit.current.quiet = !focus.pick;

        showUnderPin(L, map, focus, focus.zoom ?? Math.max(map.getZoom(), 16), true);

        map.once("moveend", () => {
            if (kit.current) {
                kit.current.quiet = false;
            }
        });
        // Only when a new focus is asked for.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, focusKey]);

    /* ---------------- frame everything ---------------- */

    useEffect(() => {
        if (!ready || !kit.current || !fitKey) {
            return;
        }

        const { L, map } = kit.current;

        const points = (fitPoints && fitPoints.length ? fitPoints : [pickup, dropoff, driver, self])
            .filter(Boolean)
            .map((place) => [place.lat, place.lng]);

        if (!fitPoints || !fitPoints.length) {
            (line || []).forEach((point) => points.push(point));
        }

        if (points.length === 0) {
            return;
        }

        const room = live.current.padding || {};

        kit.current.quiet = true;

        if (points.length === 1) {
            showUnderPin(L, map, { lat: points[0][0], lng: points[0][1] }, 15, true);
        } else {
            map.fitBounds(L.latLngBounds(points), {
                paddingTopLeft: [(room.left || 0) + 40, (room.top || 0) + 40],
                paddingBottomRight: [(room.right || 0) + 40, (room.bottom || 0) + 40],
                maxZoom: 16,
            });
        }

        map.once("moveend", () => {
            if (kit.current) {
                kit.current.quiet = false;
            }
        });
        // Only when asked (fitKey changes).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, fitKey]);

    /* ---------------- the container changed size ---------------- */

    useEffect(() => {
        if (!ready || typeof ResizeObserver === "undefined" || !box.current) {
            return;
        }

        const observer = new ResizeObserver(() => kit.current?.map.invalidateSize());

        observer.observe(box.current);

        return () => observer.disconnect();
    }, [ready]);

    const room = padding || {};

    return (
        <div className={`go-map-wrap ${className}`}>
            <div ref={box} className="tk-map go-map" role="img" aria-label={label} />
            {pick && (
                <div
                    className={`go-center-pin is-${pick === "pickup" ? "from" : "to"}`}
                    style={{
                        left: `calc(${room.left || 0}px + (100% - ${(room.left || 0) + (room.right || 0)}px) / 2)`,
                        top: `calc(${room.top || 0}px + (100% - ${(room.top || 0) + (room.bottom || 0)}px) / 2)`,
                    }}
                    aria-hidden="true"
                >
                    <span className="go-center-pin-head"><b>{pick === "pickup" ? "A" : "B"}</b></span>
                    <span className="go-center-pin-stick" />
                    <span className="go-center-pin-dot" />
                </div>
            )}
        </div>
    );
}
