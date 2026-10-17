/*
 * ============================================================
 * TAYEB API CLIENT
 * ============================================================
 *
 * The browser only talks to Tayeb's own server. Errors come
 * back as ApiError with the server's message, a code and the
 * HTTP status (401 means "log in again").
 */

export class ApiError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

async function request(url, options) {
    let response;

    try {
        response = await fetch(url, {
            credentials: "include",
            ...options,
        });
    } catch {
        throw new ApiError(
            "No internet connection. Check your network and try again.",
            0,
            "OFFLINE"
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new ApiError(
            data.error || "Something went wrong. Please try again.",
            response.status,
            data.code
        );
    }

    return data;
}

export function apiGet(url) {
    return request(url, {
        method: "GET",
    });
}

export function apiPost(url, body) {
    return request(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body || {}),
    });
}

/*
 * Runs `callback` once now, then every `ms` while the page is
 * visible, and again when the person comes back to the tab.
 * Returns a stop function.
 */
export function pollWhileVisible(callback, ms) {
    const first = setTimeout(callback, 0);

    const timer = setInterval(() => {
        if (document.visibilityState === "visible") {
            callback();
        }
    }, ms);

    function onVisible() {
        if (document.visibilityState === "visible") {
            callback();
        }
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
        clearTimeout(first);
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
    };
}
