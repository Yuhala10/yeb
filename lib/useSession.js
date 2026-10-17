import { useRouter } from "next/router";
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

function forget() {
    try {
        localStorage.removeItem("tayebUser");
        localStorage.removeItem("selectedRole");
    } catch {
        // Storage blocked: nothing to forget.
    }
}

/*
 * Session over (or wrong account type): back to login. The
 * staff console goes to the home page instead, so its
 * entrance isn't advertised.
 */
export function leaveDashboard(router, role) {
    forget();
    router.replace(role === "ADMIN" ? "/" : "/login");
}

export async function logout(router) {
    try {
        await fetch("/api/session/logout", { method: "POST", credentials: "include" });
    } catch {
        // Offline: the cookie expires on its own.
    }

    forget();
    router.replace("/login");
}

/*
 * For dashboards: the signed-in user if they have `role`,
 * otherwise they're sent away. Returns [user, setUser].
 */
export function useRoleUser(role) {
    const router = useRouter();

    const [user, setUser] = useState(null);

    useEffect(() => {
        let alive = true;

        apiGet("/api/session/me")
            .then((result) => {
                if (!alive) {
                    return;
                }

                if (result.user?.role !== role) {
                    leaveDashboard(router, role);
                    return;
                }

                setUser(result.user);

                try {
                    localStorage.setItem("selectedRole", role);
                } catch {
                    // Storage blocked: login still works.
                }
            })
            .catch(() => alive && leaveDashboard(router, role));

        return () => {
            alive = false;
        };
        // Once per page: router is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    return [user, setUser];
}

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

    router.push(`/login?role=${role}`);
}
