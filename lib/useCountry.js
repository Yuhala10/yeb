import { useEffect, useState } from "react";

import { apiGet } from "./api";
import { DEFAULT_COUNTRY, findCountry } from "./countries";

const STORAGE_KEY = "tayebCountry";

/*
 * The visitor's country: what they chose before (saved on
 * this phone), else where the network says they are, else
 * Cameroon. `initial` (from the server) avoids a flash.
 */
export function useVisitorCountry(initial) {
    const [country, setCountryState] = useState(findCountry(initial)?.code || DEFAULT_COUNTRY);

    useEffect(() => {
        let alive = true;

        let saved = null;

        try {
            saved = findCountry(localStorage.getItem(STORAGE_KEY))?.code || null;
        } catch {
            saved = null;
        }

        if (saved) {
            // Deferred so the first paint matches the server.
            const timer = setTimeout(() => alive && setCountryState(saved), 0);

            return () => {
                alive = false;
                clearTimeout(timer);
            };
        }

        if (initial) {
            return () => {
                alive = false;
            };
        }

        apiGet("/api/geo")
            .then((result) => {
                if (alive && findCountry(result.country)) {
                    setCountryState(result.country);
                }
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, [initial]);

    function setCountry(code) {
        const found = findCountry(code);

        if (!found) {
            return;
        }

        setCountryState(found.code);

        try {
            localStorage.setItem(STORAGE_KEY, found.code);
        } catch {
            // Not saved: still used for this visit.
        }
    }

    return [country, setCountry];
}

/*
 * Server side: the visitor's country from the hosting network
 * (Vercel's x-vercel-ip-country), if it's a Tayeb country.
 */
export function countryFromRequest(req) {
    return findCountry(String(req?.headers?.["x-vercel-ip-country"] || ""))?.code || null;
}
