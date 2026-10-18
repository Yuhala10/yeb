import ErrorScreen from "../components/Site/ErrorScreen";

/*
 * Something went wrong on Tayeb's side.
 *
 * Built with getStaticProps for the same reason as 404.js
 * (one French and one English page for Vercel).
 */
export function getStaticProps() {
    return { props: {} };
}

export default function ServerError() {
    return (
        <ErrorScreen
            code="500"
            title={{ fr: "Petit arrêt sur la route.", en: "A short stop on the road." }}
            text={{
                fr: "Quelque chose n'a pas marché de notre côté. Réessayez dans un instant : vos données sont en sécurité.",
                en: "Something didn't work on our side. Try again in a moment: your data is safe.",
            }}
        />
    );
}
