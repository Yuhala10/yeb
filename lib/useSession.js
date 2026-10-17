import { useEffect, useState } from "react";

import { apiGet } from "./api";

/*
 * The signed-in user for public pages (market, listings):
 * { loading: true } at first, then { user } or { user: null }.
 */
export function useSession() {
    const [state, setState] = useState({
        loading: true,
        user: null,
    });

    useEffect(() => {
        let alive = true;

        apiGet("/api/session/me")
            .then((result) => {
                if (alive) {
                    setState({ loading: false, user: result.user || null });
                }
            })
            .catch(() => {
                if (alive) {
                    setState({ loading: false, user: null });
                }
            });

        return () => {
            alive = false;
        };
    }, []);

    return state;
}

export const DASHBOARDS = {
    SHIPPER: "/shipper",
    DRIVER: "/driver",
    FARMER: "/farmer",
    ADMIN: "/admin",
};

/*
 * Sends the person to login, then back to `returnTo` (a path
 * on this site) once they are signed in with `role`.
 */
export function loginThenReturn(router, role, returnTo) {
    try {
        localStorage.setItem("selectedRole", role);

        if (returnTo && returnTo.startsWith("/")) {
            localStorage.setItem("tayebReturnTo", returnTo);
        }
    } catch {
        // Storage blocked: login still works, without the return trip.
    }

    router.push("/login");
}
