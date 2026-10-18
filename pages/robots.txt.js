import { siteOrigin } from "../lib/seo";

/*
 * /robots.txt: public pages are open to search engines;
 * dashboards and the API are not (in both languages). The
 * preview card images stay open so link previews work.
 * Points to the sitemap on whatever domain Tayeb is served
 * from.
 *
 * Unlisted pages (the staff entrance) are deliberately not
 * named here, since robots.txt is public: they carry noindex.
 */
const PRIVATE = ["/admin", "/driver", "/shipper", "/farmer", "/track/"];

export async function getServerSideProps({ req, res }) {
    const body = [
        "User-agent: *",
        "Allow: /",
        "Allow: /api/og",
        "Disallow: /api/",
        ...PRIVATE.flatMap((path) => [`Disallow: ${path}`, `Disallow: /en${path}`]),
        "Disallow: /*?q=",
        "Disallow: /*&q=",
        "",
        `Sitemap: ${siteOrigin(req)}/sitemap.xml`,
        "",
    ].join("\n");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.write(body);
    res.end();

    return { props: {} };
}

export default function Robots() {
    return null;
}
