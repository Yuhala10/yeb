/*
 * /robots.txt: public pages are open to search engines;
 * dashboards and the API are not. Points to the sitemap on
 * whatever domain Tayeb is served from.
 */
export async function getServerSideProps({ req, res }) {
    const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    const body = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "Disallow: /admin",
        "Disallow: /driver",
        "Disallow: /shipper",
        "Disallow: /farmer",
        "",
        `Sitemap: ${protocol}://${host}/sitemap.xml`,
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
