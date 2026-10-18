import { Html, Head, Main, NextScript } from "next/document";

/*
 * The page language (fr/en) comes from the address (i18n in
 * next.config.mjs); app-wide tags live in _app.js and each
 * page sets its own title, description and previews.
 */
export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* Light or dark before the first paint (a tiny file: the security policy allows no inline script). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme.js" />
      </Head>

      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
