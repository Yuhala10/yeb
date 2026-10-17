import {
    listNotifications,
    markNotificationsRead,
    sendError,
} from "../../lib/server/engine";
import { getSession } from "../../lib/server/session";

/*
 * GET  → the signed-in user's latest notifications
 * POST → { id } marks one read, {} marks all read
 */
export default async function handler(req, res) {
    const session = await getSession(req);

    if (!session || session.admin) {
        return res.status(401).json({ error: "Please log in again." });
    }

    try {
        if (req.method === "GET") {
            return res.status(200).json({
                notifications: await listNotifications(session.user),
            });
        }

        if (req.method === "POST") {
            await markNotificationsRead(session.user, req.body || {});

            return res.status(200).json({ success: true });
        }

        res.setHeader("Allow", ["GET", "POST"]);

        return res.status(405).json({ error: "Method not allowed." });
    } catch (error) {
        return sendError(res, error);
    }
}
