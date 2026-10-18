import { useEffect, useState } from "react";

import { apiPost } from "./api";
import { distanceKm } from "./cities";

/*
 * ============================================================
 * SHARE THE DRIVER'S POSITION
 * ============================================================
 *
 * While `active` (on the way to the pickup or on the road),
 * the phone's GPS position goes to Tayeb: every 15 seconds,
 * or as soon as the truck has moved 50 m. Rough fixes (wider
 * than 150 m) are only sent when nothing better arrived for a
 * minute. The screen is kept on, because phones stop GPS in
 * web pages when the screen sleeps.
 *
 * Returns { state, position, retry }:
 *   state: "idle" | "on" | "denied" | "unsupported"
 */

const EVERY_MS = 15000;

const MIN_MOVE_M = 50;

const ROUGH_M = 150;

export function useLiveLocation(shipmentId, active) {
    const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

    const [state, setState] = useState("idle");

    const [position, setPosition] = useState(null);

    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!shipmentId || !active || !supported) {
            return;
        }

        let lastSentAt = 0;
        let lastSent = null;
        let lock = null;
        let stopped = false;

        const watchId = navigator.geolocation.watchPosition(
            (fix) => {
                const point = {
                    lat: fix.coords.latitude,
                    lng: fix.coords.longitude,
                    accuracy: fix.coords.accuracy,
                    speed: fix.coords.speed,
                    heading: fix.coords.heading,
                    at: Date.now(),
                };

                setState("on");
                setPosition(point);

                const since = Date.now() - lastSentAt;

                const movedM = lastSent ? distanceKm(lastSent, point) * 1000 : Infinity;

                if (point.accuracy > ROUGH_M && since < 60000) {
                    return;
                }

                if (since < EVERY_MS && movedM < MIN_MOVE_M) {
                    return;
                }

                lastSentAt = Date.now();
                lastSent = point;

                apiPost("/api/driver", {
                    action: "location",
                    shipmentId,
                    lat: point.lat,
                    lng: point.lng,
                    accuracy: point.accuracy,
                    speed: point.speed,
                    heading: point.heading,
                }).catch(() => {
                    // Next fix tries again.
                    lastSentAt = 0;
                });
            },
            (error) => setState(error.code === error.PERMISSION_DENIED ? "denied" : "idle"),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
        );

        // Keep the screen on while the goods move.
        async function keepAwake() {
            try {
                if (!stopped && "wakeLock" in navigator && document.visibilityState === "visible") {
                    lock = await navigator.wakeLock.request("screen");
                }
            } catch {
                lock = null;
            }
        }

        function onVisible() {
            if (document.visibilityState === "visible") {
                keepAwake();
            }
        }

        keepAwake();

        document.addEventListener("visibilitychange", onVisible);

        return () => {
            stopped = true;
            navigator.geolocation.clearWatch(watchId);
            document.removeEventListener("visibilitychange", onVisible);
            lock?.release?.().catch?.(() => {});
        };
    }, [shipmentId, active, supported, attempt]);

    return {
        state: supported ? state : "unsupported",
        position,
        retry() {
            setState("idle");
            setAttempt((count) => count + 1);
        },
    };
}
