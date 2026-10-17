import Head from "next/head";

import { useLanguage } from "../../lib/LanguageContext";
import { alternates, jsonLd, localizedUrl, siteCardUrl } from "../../lib/seo";

/*
 * Everything search engines and link previews read, for one
 * page: title, description, canonical address in the current
 * language, the French/English alternates, Open Graph and
 * Twitter cards, and structured data (schema.org).
 *
 * path: the page path without the language ("/market/abc").
 * image: a 1200×630 preview card (lib/seo.js); without one,
 * the Tayeb card for the home page.
 */
export default function Seo({
    origin,
    path = "/",
    title,
    description,
    image,
    imageAlt,
    type = "website",
    noindex = false,
    structuredData = [],
    extra = null,
}) {
    const { language } = useLanguage();

    const canonical = localizedUrl(origin, path, language);

    const picture = image || siteCardUrl(origin, "home", language);

    const pictureAlt = imageAlt || title;

    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} key="description" />
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
            <meta name="theme-color" content="#f97316" key="theme-color" />
            {noindex ? (
                <meta name="robots" content="noindex, nofollow" />
            ) : (
                <meta name="robots" content="index, follow, max-image-preview:large" />
            )}

            <link rel="canonical" href={canonical} />
            {!noindex &&
                alternates(origin, path).map((item) => (
                    <link key={item.hrefLang} rel="alternate" hrefLang={item.hrefLang} href={item.href} />
                ))}

            <meta property="og:type" content={type} />
            <meta property="og:site_name" content="Tayeb" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={picture} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={pictureAlt} />
            <meta property="og:locale" content={language === "fr" ? "fr_FR" : "en_GB"} />
            <meta property="og:locale:alternate" content={language === "fr" ? "en_GB" : "fr_FR"} />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={picture} />
            <meta name="twitter:image:alt" content={pictureAlt} />

            {structuredData.filter(Boolean).map((data, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={jsonLd(data)}
                />
            ))}

            {extra}
        </Head>
    );
}
