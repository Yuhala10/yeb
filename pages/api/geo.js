import { findCountry } from "../../lib/countries";

/*
 * The visitor's country from the hosting network (Vercel adds
 * x-vercel-ip-country), when it is a Tayeb country. Used to
 * pick the right phone format, currency and cities first.
 */
export default function handler(req, res) {
    const code = String(req.headers["x-vercel-ip-country"] || "").toUpperCase();

    res.setHeader("Cache-Control", "private, max-age=3600");

    return res.status(200).json({
        country: findCountry(code)?.code || null,
    });
}
