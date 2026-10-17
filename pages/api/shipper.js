import {
    EngineError,
    priceHintForRoute,
    sendError,
    shipperAccept,
    shipperCounter,
    shipperDashboard,
    shipperPostLoad,
    shipperRate,
    shipperUpdateStatus,
} from "../../lib/server/engine";
import { requireRole } from "../../lib/server/session";

/*
 * GET               → the shipper's loads and offers
 * GET ?from=&to=    → typical price for a route
 * POST              → { action, ...input }
 */
const ACTIONS = {
    post: shipperPostLoad,
    counter: shipperCounter,
    accept: shipperAccept,
    status: shipperUpdateStatus,
    rate: shipperRate,
};

export default async function handler(req, res) {
    const shipper = await requireRole(req, res, "SHIPPER");

    if (!shipper) {
        return;
    }

    try {
        if (req.method === "GET") {
            if (req.query.from || req.query.to) {
                return res
                    .status(200)
                    .json(await priceHintForRoute(req.query.from, req.query.to));
            }

            return res.status(200).json(await shipperDashboard(shipper));
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", ["GET", "POST"]);
            return res.status(405).json({ error: "Method not allowed." });
        }

        const { action, ...input } = req.body || {};

        const run = ACTIONS[action];

        if (!run) {
            throw new EngineError("Unknown action.");
        }

        return res.status(200).json({
            success: true,
            ...(await run(shipper, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
