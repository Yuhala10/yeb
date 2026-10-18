import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";

/*
 * ============================================================
 * TRIP MAP (Leaflet + OpenStreetMap)
 * ============================================================
 *
 * Pickup (A) and delivery (B) pins with their town names, the
 * real trail already driven, the road still ahead (dashed),
 * and the truck: an arrow turned in its direction of travel,
 * with its GPS accuracy, gliding to each new position.
 *
 * Map tiles: OpenStreetMap by default. Set NEXT_PUBLIC_MAP_TILES
 * (and NEXT_PUBLIC_MAP_ATTRIBUTION) to use another provider.
 *
 * props:
 *   from, to: { name, lat, lng }      trail: [[lat, lng], …]
 *   truck: { lat, lng, accuracy } | null       heading: degrees
 *   phase: "TO_PICKUP" | "TO_DESTINATION" | …
 *   compact: small, non-interactive preview
 *   follow: keep the truck in view as it moves
 *   recenter: change this number to fit everything again
 *   padding: { top, right, bottom, left } kept clear of panels
 */

const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATTRIBUTION =
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const ORANGE = "#f97316";
const INK = "#0b1220";

const ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5 19.5 20.5 12 16.6 4.5 20.5Z" fill="white"/></svg>';

function escapeHtml(text) {
    return String(text || "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export default function TripMap({
    from,
    to,
    trail = [],
    truck = null,
    heading = null,
    phase,
    compact = false,
    follow = false,
    recenter = 0,
    padding = {},
    className = "",
    label,
}) {
    const box = useRef(null);

    const kit = useRef(null);

    const [ready, setReady] = useState(false);

    // The latest padding, for fits that happen later.
    const space = useRef(padding);

    useEffect(() => {
        space.current = padding;
    });

    /* ---------------- create the map once ---------------- */

    useEffect(() => {
        let cancelled = false;

        import("leaflet").then((module) => {
            if (cancelled || !box.current) {
                return;
            }

            const L = module.default || module;

            const map = L.map(box.current, {
                zoomControl: false,
                attributionControl: true,
                dragging: !compact,
                touchZoom: !compact,
                scrollWheelZoom: !compact,
                doubleClickZoom: !compact,
                boxZoom: false,
                keyboard: !compact,
                zoomSnap: 0.25,
            });

            map.attributionControl.setPrefix(false);

            L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

            if (!compact) {
                L.control.zoom({ position: "topright" }).addTo(map);
            }

            kit.current = { L, map, layers: {}, fitted: false, at: null, frame: null };

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
    }, [compact]);

    /* ---------------- draw and update ---------------- */

    useEffect(() => {
        if (!ready || !kit.current) {
            return;
        }

        const { L, map, layers } = kit.current;

        function pin(key, place, letter, tone) {
            if (!place) {
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
                }).addTo(map);

                if (!compact) {
                    layers[key].bindTooltip(escapeHtml(place.name), {
                        permanent: true,
                        direction: "top",
                        offset: [0, -16],
                        className: "tk-label",
                    });
                }
            } else {
                layers[key].setLatLng([place.lat, place.lng]);
            }
        }

        pin("from", from, "A", "from");
        pin("to", to, "B", "to");

        // Road already driven: white casing under orange.
        const path = trail.length > 1 ? trail : [];

        if (!layers.casing) {
            layers.casing = L.polyline(path, { color: "white", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
            layers.trail = L.polyline(path, { color: ORANGE, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
        } else {
            layers.casing.setLatLngs(path);
            layers.trail.setLatLngs(path);
        }

        // Road still ahead, dashed: from the truck (or the pickup) to the target.
        const target = phase === "TO_PICKUP" ? from : to;

        const start = truck || (phase === "TO_PICKUP" ? null : from);

        const ahead = start && target && phase !== "ARRIVED" && phase !== "DONE" ? [[start.lat, start.lng], [target.lat, target.lng]] : [];

        if (!layers.ahead) {
            layers.ahead = L.polyline(ahead, { color: INK, weight: 3, opacity: 0.45, dashArray: "2 9", lineCap: "round", interactive: false }).addTo(map);
        } else {
            layers.ahead.setLatLngs(ahead);
        }

        // The truck.
        if (truck) {
            const goal = [truck.lat, truck.lng];

            if (!layers.truck) {
                layers.truck = L.marker(goal, {
                    icon: L.divIcon({
                        className: "",
                        html: `<div class="tk-truck"><span class="tk-truck-halo"></span><span class="tk-truck-arrow">${ARROW}</span></div>`,
                        iconSize: [48, 48],
                        iconAnchor: [24, 24],
                    }),
                    keyboard: false,
                    interactive: false,
                    zIndexOffset: 1000,
                }).addTo(map);

                layers.accuracy = L.circle(goal, {
                    radius: Math.max(5, Number(truck.accuracy) || 0),
                    color: ORANGE,
                    weight: 1,
                    opacity: 0.5,
                    fillColor: ORANGE,
                    fillOpacity: 0.08,
                    interactive: false,
                }).addTo(map);

                kit.current.at = goal;
            } else {
                // Glide from where the truck was to where it is now.
                const startAt = kit.current.at || goal;
                const began = performance.now();

                cancelAnimationFrame(kit.current.frame);

                const step = (now) => {
                    const share = Math.min(1, (now - began) / 1100);
                    const eased = 1 - (1 - share) ** 3;
                    const here = [startAt[0] + (goal[0] - startAt[0]) * eased, startAt[1] + (goal[1] - startAt[1]) * eased];

                    layers.truck?.setLatLng(here);
                    layers.accuracy?.setLatLng(here);
                    kit.current.at = here;

                    if (share < 1 && kit.current) {
                        kit.current.frame = requestAnimationFrame(step);
                    }
                };

                kit.current.frame = requestAnimationFrame(step);

                layers.accuracy.setRadius(Math.max(5, Number(truck.accuracy) || 0));
            }

            const arrow = layers.truck.getElement()?.querySelector(".tk-truck-arrow");

            if (arrow) {
                arrow.style.transform = `rotate(${Number(heading) || 0}deg)`;
                arrow.style.opacity = heading === null || heading === undefined ? "0.0" : "1";
            }

            const halo = layers.truck.getElement()?.querySelector(".tk-truck");

            if (halo) {
                halo.classList.toggle("is-still", heading === null || heading === undefined);
            }

            // Keep the truck in the part of the map that isn't under a panel.
            if (follow && kit.current.fitted) {
                const room = space.current || {};

                map.panInside(goal, {
                    paddingTopLeft: [(room.left ?? 40) + 20, (room.top ?? 40) + 20],
                    paddingBottomRight: [(room.right ?? 40) + 20, (room.bottom ?? 40) + 20],
                    animate: true,
                });
            }
        } else if (layers.truck) {
            layers.truck.remove();
            layers.accuracy.remove();
            delete layers.truck;
            delete layers.accuracy;
        }

        // Frame everything the first time.
        if (!kit.current.fitted) {
            fit();
            kit.current.fitted = true;
        }

        function fit() {
            const points = [from, to, truck].filter(Boolean).map((place) => [place.lat, place.lng]);

            trail.forEach((point) => points.push(point));

            if (points.length === 0) {
                map.setView([4.05, 9.77], 6);
                return;
            }

            if (points.length === 1) {
                map.setView(points[0], 13);
                return;
            }

            const room = space.current || {};

            map.fitBounds(L.latLngBounds(points), {
                paddingTopLeft: [room.left ?? 40, room.top ?? 40],
                paddingBottomRight: [room.right ?? 40, room.bottom ?? 40],
                maxZoom: 15,
            });
        }

        kit.current.fit = fit;
    }, [ready, from, to, trail, truck, heading, phase, follow, compact]);

    /* ---------------- fit again on request ---------------- */

    useEffect(() => {
        if (recenter && kit.current?.fit) {
            kit.current.fit();
        }
    }, [recenter]);

    /* ---------------- the container changed size ---------------- */

    useEffect(() => {
        if (!ready || typeof ResizeObserver === "undefined" || !box.current) {
            return;
        }

        const observer = new ResizeObserver(() => kit.current?.map.invalidateSize());

        observer.observe(box.current);

        return () => observer.disconnect();
    }, [ready]);

    return <div ref={box} className={`tk-map ${compact ? "is-compact" : ""} ${className}`} role="img" aria-label={label || "Map"} />;
}
