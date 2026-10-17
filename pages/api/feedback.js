import supabaseAdmin from "../../lib/supabaseAdmin";
import { getSession } from "../../lib/server/session";

const TYPES = ["SUGGESTION", "PROBLEM", "DISPUTE"];

/*
 * Anyone can send feedback; signed-in users are linked to it.
 */
export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    const { type, message, phone } = req.body || {};

    const text = String(message || "").trim().slice(0, 2000);

    if (!text) {
        return res.status(400).json({ error: "Please enter your feedback." });
    }

    const session = await getSession(req);

    const { error } = await supabaseAdmin.from("feedback").insert([
        {
            user_id: session && !session.admin ? session.user.id : null,
            feedback_type: TYPES.includes(type) ? type : "SUGGESTION",
            message: text,
            contact_phone: String(phone || "").trim().slice(0, 30) || null,
            status: "UNREAD",
        },
    ]);

    if (error) {
        console.error("Feedback error:", error);
        return res.status(500).json({ error: "Could not send your feedback." });
    }

    return res.status(200).json({ success: true });
}
