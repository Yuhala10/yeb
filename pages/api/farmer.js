import { EngineError, sendError, socialReady } from "../../lib/server/core";
import {
    farmerAddPhoto,
    farmerArrangePhotos,
    farmerConfirmOrder,
    farmerDashboard,
    farmerDeclineOrder,
    farmerMarkPaid,
    farmerSaveProduct,
    farmerSetProductStatus,
} from "../../lib/server/market";
import { requireRole } from "../../lib/server/session";
import { ensureHandle } from "../../lib/server/social";

/*
 * GET  → the farmer's products and orders
 * POST → { action, ...input }
 */
const ACTIONS = {
    saveProduct: farmerSaveProduct,
    productStatus: farmerSetProductStatus,
    addPhoto: farmerAddPhoto,
    arrangePhotos: farmerArrangePhotos,
    // Older screens sent one photo with "photo".
    photo: farmerAddPhoto,
    confirm: farmerConfirmOrder,
    decline: farmerDeclineOrder,
    paid: farmerMarkPaid,
};

// Product photos arrive as compressed data URLs, one at a time.
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "4mb",
        },
    },
};

export default async function handler(req, res) {
    const farmer = await requireRole(req, res, "FARMER");

    if (!farmer) {
        return;
    }

    try {
        if (req.method === "GET") {
            // Every farmer gets their page address the first time.
            const fresh = await ensureHandle(farmer);

            return res.status(200).json({
                ...(await farmerDashboard(fresh)),
                social: await socialReady(),
            });
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
            ...(await run(farmer, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
