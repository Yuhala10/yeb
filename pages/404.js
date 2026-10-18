import ErrorScreen from "../components/Site/ErrorScreen";

/*
 * Page not found.
 *
 * Built with getStaticProps on purpose: with two languages,
 * Next.js 16 otherwise hands Vercel the French error page
 * twice and the deployment fails ("chmod … fr/500.html").
 */
export function getStaticProps() {
    return { props: {} };
}

export default function NotFound() {
    return (
        <ErrorScreen
            code="404"
            title={{ fr: "Cette route ne mène nulle part.", en: "This road leads nowhere." }}
            text={{
                fr: "La page a peut-être été déplacée, ou le produit n'est plus en vente.",
                en: "The page may have moved, or the product is no longer on sale.",
            }}
        />
    );
}
