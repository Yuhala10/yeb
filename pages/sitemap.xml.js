import { COUNTRIES } from "../lib/countries";
import { CATEGORIES, findProduct } from "../lib/produce";
import { localizedUrl, siteOrigin } from "../lib/seo";
import { sitemapListings } from "../lib/server/market";

/*
 * /sitemap.xml for search engines. Every page is listed in
 * French and English, each pointing to the other (hreflang),
 * and products carry their photos for image search.
 *
 * Market pages for a country, category or product are listed
 * only when something is on sale there: empty pages hurt how
 * search engines judge the whole site.
 */

function escape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function entry(origin, { path, lastmod, images = [] }) {
    const links = [
        ["fr", localizedUrl(origin, path, "fr")],
        ["en", localizedUrl(origin, path, "en")],
        ["x-default", localizedUrl(origin, path, "fr")],
    ]
        .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(href)}"/>`)
        .join("");

    const date = lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : "";

    const pictures = images
        .slice(0, 8)
        .map((image) => `<image:image><image:loc>${escape(image)}</image:loc></image:image>`)
        .join("");

    return ["fr", "en"]
        .map((language) => `<url><loc>${escape(localizedUrl(origin, path, language))}</loc>${links}${date}${pictures}</url>`)
        .join("\n");
}

export async function getServerSideProps({ req, res }) {
    const origin = siteOrigin(req);

    let listings = [];

    try {
        listings = await sitemapListings();
    } catch (error) {
        console.error("Sitemap error:", error);
    }

    const countries = new Set(listings.map((item) => item.country));

    const products = new Set(listings.map((item) => item.product).filter((key) => key !== "OTHER"));

    const categories = new Set([...products].map((key) => findProduct(key)?.category).filter(Boolean));

    const newest = listings[0]?.updated_at;

    const pages = [
        { path: "/", lastmod: newest },
        { path: "/market", lastmod: newest },
        { path: "/about" },
        ...COUNTRIES.filter((item) => countries.has(item.code)).map((item) => ({ path: `/market?country=${item.code}` })),
        ...CATEGORIES.filter((item) => categories.has(item.key)).map((item) => ({ path: `/market?category=${item.key}` })),
        ...[...products].map((key) => ({ path: `/market?product=${key}` })),
        ...listings.map((listing) => ({
            path: `/market/${listing.id}`,
            lastmod: listing.updated_at,
            images: listing.photos,
        })),
    ];

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        ...pages.map((page) => entry(origin, page)),
        "</urlset>",
    ].join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    res.write(xml);
    res.end();

    return { props: {} };
}

export default function Sitemap() {
    return null;
}
