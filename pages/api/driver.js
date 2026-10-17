import {
    driverAcceptCounter,
    driverCounter,
    driverDashboard,
    driverLocation,
    driverOffer,
    driverUpdateProfile,
    driverUpdateStatus,
    EngineError,
    sendError,
} from "../../lib/server/engine";
import { requireRole } from "../../lib/server/session";

/*
 * GET  → the driver's dashboard (ranked loads, jobs, offers)
 * POST → { action, ...input }
 */
const ACTIONS = {
    offer: driverOffer,
    counter: driverCounter,
    acceptCounter: driverAcceptCounter,
    profile: driverUpdateProfile,
    status: driverUpdateStatus,
    location: driverLocation,
};

export default async function handler(req, res) {
    const driver = await requireRole(req, res, "DRIVER");

    if (!driver) {
        return;
    }

    try {
        if (req.method === "GET") {
            return res.status(200).json(await driverDashboard(driver));
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
            ...(await run(driver, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
