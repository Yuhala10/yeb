import { EngineError, sendError } from "../../lib/server/core";
import {
    goAccept,
    goActive,
    goAtPickup,
    goCancel,
    goDecline,
    goDriver,
    goDropJob,
    goHeartbeat,
    goNearby,
    goOnline,
    goQuote,
    goReady,
    goRequest,
    goRetry,
    goToBoard,
    goTrip,
    goVehicleClass,
} from "../../lib/server/go";
import { limitByIp } from "../../lib/server/guard";
import { getSession } from "../../lib/server/session";

/*
 * ============================================================
 * TAYEB GO API
 * ============================================================
 *
 * GET  ?ready=1               is Tayeb Go set up (anyone)
 * GET  ?near=lat,lng          anonymous cars nearby (signed in)
 * GET  ?mine=1                the customer's trip in progress
 * GET  ?trip=<id>             one trip, as its customer sees it
 * GET  ?driver=1[&full=1]     the driver's request and job
 * POST { action, ...input }   see ACTIONS
 */

const CUSTOMER = {
    quote: goQuote,
    request: goRequest,
    cancel: goCancel,
    retry: goRetry,
    board: goToBoard,
};

const DRIVER = {
    online: goOnline,
    heartbeat: goHeartbeat,
    accept: goAccept,
    decline: goDecline,
    atPickup: goAtPickup,
    dropJob: goDropJob,
    vehicleClass: goVehicleClass,
};

function noStore(res) {
    res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
    noStore(res);

    try {
        if (req.method === "GET" && req.query.ready) {
            return res.status(200).json({ ready: await goReady() });
        }

        const session = await getSession(req);

        if (!session || session.admin) {
            return res.status(401).json({ error: "Please log in again." });
        }

        const user = session.user;

        if (req.method === "GET") {
            if (req.query.near) {
                if (limitByIp(req, res, "go-near", 90, 60000)) {
                    return;
                }

                const [lat, lng] = String(req.query.near).split(",").map(Number);

                return res.status(200).json(await goNearby(user, { lat, lng }));
            }

            if (req.query.driver) {
                if (user.role !== "DRIVER") {
                    return res.status(403).json({ error: "This account can't do that." });
                }

                return res.status(200).json(await goDriver(user, { full: Boolean(req.query.full) }));
            }

            if (user.role !== "SHIPPER") {
                return res.status(403).json({ error: "This account can't do that." });
            }

            if (req.query.trip) {
                return res.status(200).json(await goTrip(user, String(req.query.trip)));
            }

            return res.status(200).json(await goActive(user));
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", ["GET", "POST"]);
            return res.status(405).json({ error: "Method not allowed." });
        }

        const { action, ...input } = req.body || {};

        const table = user.role === "DRIVER" ? DRIVER : user.role === "SHIPPER" ? CUSTOMER : null;

        const run = table?.[action];

        if (!run) {
            throw new EngineError("Unknown action.");
        }

        if (action === "quote" && limitByIp(req, res, "go-quote", 60, 60000)) {
            return;
        }

        if ((action === "accept" || action === "decline") && limitByIp(req, res, "go-answer", 60, 60000)) {
            return;
        }

        return res.status(200).json({
            success: true,
            ...(await run(user, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
