import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>

        <meta name="theme-color" content="#0f172a" />

        <meta
          name="description"
          content="Tayeb Cargo Transport Platform"
        />

        <link rel="manifest" href="/manifest.json" />

        <link
          rel="icon"
          href="/branding/tayeb-icon.jpeg"
        />

        <link
          rel="apple-touch-icon"
          href="/branding/tayeb-icon-dark.jpeg"
        />

      </Head>

      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}