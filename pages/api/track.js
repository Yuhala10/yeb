import { sendError } from "../../lib/server/core";
import { limitByIp } from "../../lib/server/guard";
import { getSession } from "../../lib/server/session";
import { trackView } from "../../lib/server/tracking";

/*
 * GET /api/track?id=<load id>[&t=<private link token>]
 *
 * One trip for the live map: route, trail, the truck's last
 * position and what it means (distance left, speed, arrival
 * time…). For the shipper, the driver and staff when signed
 * in, or for the receiver with the private link.
 */
export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    // Generous: a map refreshes every 10 seconds per viewer.
    if (limitByIp(req, res, "track", 400, 10 * 60 * 1000)) {
        return;
    }

    res.setHeader("Cache-Control", "private, no-store");

    try {
        const session = await getSession(req);

        return res.status(200).json(await trackView(session, String(req.query.id || ""), req.query.t ? String(req.query.t) : null));
    } catch (error) {
        return sendError(res, error);
    }
}
