import { adminDashboard, sendError } from "../../../lib/server/engine";
import { requireRole } from "../../../lib/server/session";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    const admin = await requireRole(req, res, "ADMIN");

    if (!admin) {
        return;
    }

    try {
        return res.status(200).json(await adminDashboard());
    } catch (error) {
        return sendError(res, error);
    }
}
