import {
    getSession,
    publicUser,
    setSessionCookie,
} from "../../../lib/server/session";

/*
 * Returns the signed-in user and renews the session, so
 * people who use Tayeb every week stay logged in.
 */
export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).json({ error: "Method not allowed." });
    }

    try {
        const session = await getSession(req);

        if (!session) {
            return res.status(401).json({
                authenticated: false,
                error: "Session is invalid or expired.",
            });
        }

        setSessionCookie(res, session.user.id);

        return res.status(200).json({
            authenticated: true,
            user: publicUser(session.user),
        });
    } catch (error) {
        console.error("Session verification error:", error);

        return res.status(500).json({
            authenticated: false,
            error: "Unable to verify session.",
        });
    }
}
