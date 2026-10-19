import { EngineError, sendError } from "../../lib/server/core";
import { limitByIp } from "../../lib/server/guard";
import { getSession } from "../../lib/server/session";
import {
    followingFeed,
    getProfile,
    mySocial,
    removeProfilePhoto,
    removeVoice,
    savedPosts,
    setFollow,
    setLike,
    setProfilePhoto,
    setSave,
    setVoice,
    updateProfile,
} from "../../lib/server/social";

/*
 * ============================================================
 * SOCIAL MARKET API
 * ============================================================
 *
 * Public:
 *   GET ?profile=<handle or id>   a farm's page and posts
 * Signed in:
 *   GET ?mine=1                   what I liked, saved, follow
 *   GET ?feed=following | saved   posts for those tabs
 *   POST like / save / follow     { productId | farmerId, on }
 *   POST photo / removePhoto      { kind: avatar | cover, image }
 * Farmers:
 *   POST profile                  { farmName, bio, languages, handle }
 *   POST voice / removeVoice      { productId, audio, seconds }
 */

const EVERYONE = {
    like: setLike,
    save: setSave,
    follow: setFollow,
    photo: setProfilePhoto,
    removePhoto: removeProfilePhoto,
};

const FARMERS = {
    profile: updateProfile,
    voice: setVoice,
    removeVoice,
};

// Photos and voice notes arrive as data URLs.
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "4mb",
        },
    },
};

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    try {
        const session = await getSession(req);

        const user = session && !session.admin ? session.user : null;

        if (req.method === "GET") {
            if (req.query.profile) {
                if (limitByIp(req, res, "social-profile", 120, 60000)) {
                    return;
                }

                return res.status(200).json(await getProfile(String(req.query.profile), user));
            }

            if (!user) {
                return res.status(401).json({ error: "Please log in again." });
            }

            if (req.query.feed === "following") {
                return res.status(200).json(await followingFeed(user));
            }

            if (req.query.feed === "saved") {
                return res.status(200).json(await savedPosts(user));
            }

            return res.status(200).json(await mySocial(user));
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", ["GET", "POST"]);
            return res.status(405).json({ error: "Method not allowed." });
        }

        if (!user) {
            return res.status(401).json({ error: "Please log in again." });
        }

        const { action, ...input } = req.body || {};

        const run = EVERYONE[action] || (user.role === "FARMER" ? FARMERS[action] : null);

        if (!run) {
            throw new EngineError(FARMERS[action] ? "This account can't do that." : "Unknown action.", FARMERS[action] ? 403 : 400);
        }

        const heavy = ["photo", "voice"].includes(action);

        if (limitByIp(req, res, heavy ? "social-upload" : "social-tap", heavy ? 30 : 180, 60000)) {
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
