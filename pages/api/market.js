import { EngineError, sendError } from "../../lib/server/core";
import {
    buyerCancelOrder,
    buyerConfirmReceived,
    buyerOrders,
    buyerPlaceOrder,
    buyerRateFarmer,
    getListing,
    listMarket,
    marketReady,
    productPrices,
} from "../../lib/server/market";
import { requireRole } from "../../lib/server/session";

/*
 * Public:
 *   GET ?status=1                 → { ready }
 *   GET ?prices=TOMATOES          → real prices for pricing a product
 *   GET ?id=…                     → one listing
 *   GET ?product=&city=&q=        → listings for sale
 * Buyers (shipper accounts):
 *   GET ?orders=mine              → my orders
 *   POST { action, ...input }     → order, cancel, received, rate
 */
const ACTIONS = {
    order: buyerPlaceOrder,
    cancel: buyerCancelOrder,
    received: buyerConfirmReceived,
    rate: buyerRateFarmer,
};

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const { status, id, orders, product, city, q, prices } = req.query;

            if (status) {
                return res.status(200).json({ ready: await marketReady() });
            }

            if (prices) {
                return res.status(200).json(await productPrices(String(prices)));
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
                    product: product ? String(product) : undefined,
                    city: city ? String(city) : undefined,
                    q: q ? String(q) : undefined,
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

        return res.status(200).json({
            success: true,
            ...(await run(buyer, input)),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
