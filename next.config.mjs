/*
 * ============================================================
 * SECURITY HEADERS
 * ============================================================
 *
 * Content-Security-Policy: the browser only runs Tayeb's own
 * scripts, loads photos from Tayeb's storage and map tiles
 * from the map provider. Injected scripts, frames and data
 * sent to other sites are refused. Production only: the dev
 * server needs eval for hot reload.
 */
const isProduction = process.env.NODE_ENV === "production";

function originOf(value) {
  try {
    return new URL(String(value).replace(/\{[a-z]\}/g, "a")).origin;
  } catch {
    return "";
  }
}

// Map tiles: OpenStreetMap unless NEXT_PUBLIC_MAP_TILES says
// otherwise. "{s}." subdomains (a., b., c.) become "*.".
const tileTemplate = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const mapTiles = tileTemplate.includes("{s}.")
  ? originOf(tileTemplate).replace("://a.", "://*.")
  : originOf(tileTemplate);

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co ${originOf(process.env.NEXT_PUBLIC_SUPABASE_URL)} ${mapTiles}`.replace(/\s+/g, " ").trim(),
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isProduction
    ? [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * French at "/", English at "/en/…". Each language gets its
   * own address, so search engines index both. Visitors whose
   * browser prefers English land on /en the first time; the
   * language switch remembers their choice (NEXT_LOCALE).
   */
  i18n: {
    locales: ["fr", "en"],
    defaultLocale: "fr",
  },

  poweredByHeader: false,

  // Link preview cards read their fonts from disk.
  outputFileTracingIncludes: {
    "/api/og": ["./public/fonts/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
