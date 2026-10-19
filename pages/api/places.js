import { inCameroon } from "../../lib/fleet";
import { placeAt, searchPlaces } from "../../lib/server/geo";
import { limitByIp } from "../../lib/server/guard";
import { getSession } from "../../lib/server/session";

/*
 * Places for Tayeb Go (signed-in people only):
 *   GET ?lat=&lng=        what is at this point
 *   GET ?q=…&near=lat,lng  search (when the person asks)
 */
export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    const session = await getSession(req);

    if (!session || session.admin) {
        return res.status(401).json({ error: "Please log in again." });
    }

    const language = req.query.lang === "en" ? "en" : "fr";

    if (req.query.q !== undefined) {
        if (limitByIp(req, res, "places-search", 30, 60000)) {
            return;
        }

        const [lat, lng] = String(req.query.near || "").split(",").map(Number);

        const near = inCameroon({ lat, lng }) ? { lat, lng } : null;

        return res.status(200).json({ results: await searchPlaces(String(req.query.q), language, near) });
    }

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!inCameroon({ lat, lng })) {
        return res.status(200).json({ place: null });
    }

    if (limitByIp(req, res, "places-reverse", 60, 60000)) {
        return;
    }

    return res.status(200).json({ place: await placeAt(lat, lng, language) });
}
