import Head from "next/head";
import "../styles/globals.css";
import "../styles/market.css";
import "../styles/site.css";

import { LanguageProvider } from "../lib/LanguageContext";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";

export default function App({ Component, pageProps }) {

  return (
    <LanguageProvider>

      <Head>

        <meta
          name="application-name"
          content="Tayeb"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="Tayeb"
        />
        <meta
          name="theme-color"
          content="#f97316"
          key="theme-color"
        />

        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
          key="viewport"
        />

        <link
          rel="manifest"
          href="/manifest.json"
        />

        <link
          rel="icon"
          href="/branding/tayeb-icon.jpeg"
        />

        <link
          rel="apple-touch-icon"
          href="/branding/tayeb-icon.jpeg"
        />

      </Head>

      <ServiceWorkerRegistration />

      <Component {...pageProps} />

    </LanguageProvider>
  );
}