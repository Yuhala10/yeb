import { NextResponse } from "next/server";

/*
 * ============================================================
 * REQUEST GUARD (runs before every API route)
 * ============================================================
 *
 * Only Tayeb's own pages may change data. A request that
 * changes something (POST, PUT, PATCH, DELETE) coming from
 * another website is refused, even though the session cookie
 * is already SameSite=Lax: defence in depth against
 * cross-site request forgery.
 *
 * Browsers say where a request comes from with Sec-Fetch-Site
 * and Origin; tools like curl send neither and still need a
 * valid session cookie or PIN to do anything.
 */

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

function blocked() {
    return NextResponse.json(
        { error: "This request was blocked. Please use the Tayeb website.", code: "CROSS_SITE" },
        { status: 403 }
    );
}

export function proxy(request) {
    if (READ_ONLY.has(request.method)) {
        return NextResponse.next();
    }

    const site = request.headers.get("sec-fetch-site");

    if (site && site !== "same-origin" && site !== "none") {
        return blocked();
    }

    const origin = request.headers.get("origin");

    if (origin) {
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

        let originHost = null;

        try {
            originHost = new URL(origin).host;
        } catch {
            originHost = null;
        }

        if (!originHost || originHost !== host) {
            return blocked();
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/api/:path*"],
};
