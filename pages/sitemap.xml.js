import { PRODUCTS } from "../lib/produce";
import { sitemapListings } from "../lib/server/market";

/*
 * /sitemap.xml for search engines: the home page, the market,
 * one page per product type, and every product on sale.
 */

function escape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export async function getServerSideProps({ req, res }) {
    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const site = `${protocol}://${host}`;

    let listings = [];

    try {
        listings = await sitemapListings();
    } catch (error) {
        console.error("Sitemap error:", error);
    }

    const urls = [
        { loc: `${site}/`, priority: "1.0", changefreq: "weekly" },
        { loc: `${site}/market`, priority: "0.9", changefreq: "hourly" },
        ...PRODUCTS.filter((item) => item.key !== "OTHER").map((item) => ({
            loc: `${site}/market?product=${item.key}`,
            priority: "0.6",
            changefreq: "daily",
        })),
        ...listings.map((listing) => ({
            loc: `${site}/market/${listing.id}`,
            lastmod: listing.updated_at,
            priority: "0.8",
            changefreq: "daily",
        })),
    ];

    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(
            (url) =>
                `<url><loc>${escape(url.loc)}</loc>${url.lastmod ? `<lastmod>${new Date(url.lastmod).toISOString()}</lastmod>` : ""}<changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`
        ),
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
