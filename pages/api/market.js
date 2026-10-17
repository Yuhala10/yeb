import { EngineError, sendError } from "../../lib/server/core";
import {
    buyerCancelOrder,
    buyerConfirmReceived,
    buyerDeleteAlert,
    buyerOrders,
    buyerPlaceOrder,
    buyerRateFarmer,
    buyerSaveAlert,
    getListing,
    listMarket,
    marketReady,
    productPrices,
} from "../../lib/server/market";
import { overLimit } from "../../lib/server/guard";
import { requireRole } from "../../lib/server/session";

/*
 * Public:
 *   GET ?status=1                          → { ready }
 *   GET ?prices=TOMATOES&country=CM        → real prices for pricing a product
 *   GET ?id=…                              → one listing (+ related)
 *   GET ?country=&product=&category=&city=&q= → listings for sale
 * Buyers (shipper accounts):
 *   GET ?orders=mine                       → my orders and alerts
 *   POST { action, ...input }              → order, cancel, received, rate,
 *                                            saveAlert, deleteAlert
 */
const ACTIONS = {
    order: buyerPlaceOrder,
    cancel: buyerCancelOrder,
    received: buyerConfirmReceived,
    rate: buyerRateFarmer,
    saveAlert: buyerSaveAlert,
    deleteAlert: buyerDeleteAlert,
};

function text(value) {
    return value ? String(value) : undefined;
}

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const { status, id, orders, product, city, q, prices, country, category } = req.query;

            if (status) {
                return res.status(200).json({ ready: await marketReady() });
            }

            if (prices) {
                return res.status(200).json(await productPrices(String(prices), text(country)));
            }

            if (orders === "mine") {
                const buyer = await requireRole(req, res, "SHIPPER");

                if (!buyer) {
                    return;
                }

                return res.status(200).json(await buyerOrders(buyer));
            }

            if (id) {
                return res.status(200).json({ listing: await getListing(String(id)) });
            }

            res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

            return res.status(200).json(
                await listMarket({
                    product: text(product),
                    city: text(city),
                    q: text(q),
                    country: text(country),
                    category: text(category),
                })
            );
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", ["GET", "POST"]);
            return res.status(405).json({ error: "Method not allowed." });
        }

        const buyer = await requireRole(req, res, "SHIPPER");

        if (!buyer) {
            return;
        }

        const { action, ...input } = req.body || {};

        const run = ACTIONS[action];

        if (!run) {
            throw new EngineError("Unknown action.");
        }

        // A real buyer never needs more than this; a script might.
        if (action === "order" && overLimit(`order|${buyer.id}`, 30, 60 * 60 * 1000)) {
            throw new EngineError("You have placed many orders in a short time. Please wait a little.", 429, "RATE_LIMITED");
        }

        return res.status(200).json({
            success: true,
            ...(await run(buyer, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
