import fs from "fs";
import path from "path";

import { ImageResponse } from "next/og";

/*
 * ============================================================
 * LINK PREVIEW CARDS (WhatsApp, Facebook, X, LinkedIn…)
 * ============================================================
 *
 * 1200×630 images drawn on the server for each product, load
 * and main page: deep ink, Tayeb orange, the product photo,
 * the price in the local currency and a clear call to act.
 *
 * Sent as JPEG (about 100–200 KB) when sharp is available:
 * WhatsApp skips large preview images. PNG otherwise.
 *
 * Fonts: Inter (SIL Open Font License) in public/fonts, read
 * from disk only (next.config.mjs ships them with the
 * function). No emoji or arrows in the cards: those glyphs
 * aren't in the fonts, and a preview must never fail.
 */

export const OG_WIDTH = 1200;

export const OG_HEIGHT = 630;

const INK = "#0b1220";
const ORANGE = "#f97316";
const ORANGE_LIGHT = "#fb923c";
const ORANGE_DEEP = "#ea580c";
const AMBER = "#f59e0b";
const GREEN = "#22c55e";

const PHOTO_SIZE = 534;

// The extended set (₦, ₵, Ŋ…) is its own family: the renderer
// keeps one font per family and weight, and falls back to
// other families for missing characters.
const FONT_FILES = [
    ["inter-latin-500-normal.woff", "Inter", 500],
    ["inter-latin-700-normal.woff", "Inter", 700],
    ["inter-latin-800-normal.woff", "Inter", 800],
    ["inter-latin-900-normal.woff", "Inter", 900],
    ["inter-latin-ext-700-normal.woff", "Inter Extended", 700],
    ["inter-latin-ext-900-normal.woff", "Inter Extended", 900],
];

let fontCache = null;

function loadFonts() {
    if (fontCache) {
        return fontCache;
    }

    const fonts = [];

    for (const [file, name, weight] of FONT_FILES) {
        try {
            fonts.push({
                name,
                data: fs.readFileSync(path.join(process.cwd(), "public", "fonts", file)),
                weight,
                style: "normal",
            });
        } catch {
            // Missing font: the card falls back to the default one.
        }
    }

    fontCache = fonts;

    return fonts;
}

let sharpModule;

async function getSharp() {
    if (sharpModule === undefined) {
        try {
            sharpModule = (await import("sharp")).default;
        } catch {
            sharpModule = null;
        }
    }

    return sharpModule;
}

export function clip(text, max) {
    const value = String(text ?? "").replace(/\s+/g, " ").trim();

    return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
}

/* =========================================================
   PRODUCT PHOTO
========================================================= */

function isJpeg(bytes) {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes) {
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

/*
 * The cover photo as a data URL, square and small. Only
 * photos from our own storage, fetched with a time limit and
 * a size limit; anything odd and the card is drawn without.
 */
export async function photoForCard(url) {
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url || !storage) {
        return null;
    }

    try {
        const photo = new URL(url);

        if (photo.protocol !== new URL(storage).protocol || photo.origin !== new URL(storage).origin) {
            return null;
        }

        const response = await fetch(photo.href, {
            signal: AbortSignal.timeout(4000),
            redirect: "error",
        });

        if (!response.ok || Number(response.headers.get("content-length") || 0) > 6 * 1024 * 1024) {
            return null;
        }

        const bytes = Buffer.from(await response.arrayBuffer());

        if (bytes.length > 6 * 1024 * 1024) {
            return null;
        }

        const sharp = await getSharp();

        if (sharp) {
            const square = await sharp(bytes, { limitInputPixels: 40_000_000 })
                .rotate()
                .resize(PHOTO_SIZE * 2, PHOTO_SIZE * 2, { fit: "cover", position: "attention" })
                .jpeg({ quality: 84 })
                .toBuffer();

            return `data:image/jpeg;base64,${square.toString("base64")}`;
        }

        if (isJpeg(bytes)) {
            return `data:image/jpeg;base64,${bytes.toString("base64")}`;
        }

        if (isPng(bytes)) {
            return `data:image/png;base64,${bytes.toString("base64")}`;
        }
    } catch (error) {
        console.error("Preview photo skipped:", error?.message);
    }

    return null;
}

/* =========================================================
   PIECES
========================================================= */

const gradientText = {
    backgroundImage: `linear-gradient(100deg, #fdba74 0%, ${ORANGE} 45%, ${AMBER} 100%)`,
    backgroundClip: "text",
    color: "transparent",
};

const orangeFill = `linear-gradient(135deg, ${ORANGE_LIGHT} 0%, ${ORANGE} 45%, ${ORANGE_DEEP} 100%)`;

function Backdrop() {
    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: OG_WIDTH,
                height: OG_HEIGHT,
                display: "flex",
                backgroundColor: INK,
                backgroundImage: [
                    "radial-gradient(circle at 92% 6%, rgba(249,115,22,0.50) 0%, rgba(249,115,22,0) 38%)",
                    "radial-gradient(circle at 4% 104%, rgba(245,158,11,0.26) 0%, rgba(245,158,11,0) 36%)",
                    "radial-gradient(circle at 62% 128%, rgba(234,88,12,0.34) 0%, rgba(234,88,12,0) 44%)",
                ].join(", "),
            }}
        >
            {/* Fine top rule: a touch of light on the edge. */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: OG_WIDTH,
                    height: 6,
                    display: "flex",
                    backgroundImage: `linear-gradient(90deg, ${ORANGE_DEEP}, ${ORANGE_LIGHT} 50%, ${AMBER})`,
                }}
            />
        </div>
    );
}

function Brand({ label }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage: orangeFill,
                    color: "white",
                    fontSize: 30,
                    fontWeight: 900,
                    boxShadow: "0 10px 28px rgba(249,115,22,0.45)",
                }}
            >
                T
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", color: "white", fontSize: 27, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.05 }}>
                    Tayeb
                </div>
                <div style={{ display: "flex", color: "rgba(255,255,255,0.58)", fontSize: 15, fontWeight: 800, letterSpacing: 3.5 }}>
                    {label}
                </div>
            </div>
        </div>
    );
}

function Host({ children }) {
    return (
        <div style={{ display: "flex", color: "rgba(255,255,255,0.52)", fontSize: 20, fontWeight: 700, letterSpacing: 0.3 }}>
            {children}
        </div>
    );
}

const CHIP_TONES = {
    glass: { backgroundColor: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(255,255,255,0.16)" },
    green: { backgroundColor: "rgba(34,197,94,0.14)", color: "#86efac", border: "1.5px solid rgba(34,197,94,0.42)" },
    amber: { backgroundColor: "rgba(245,158,11,0.14)", color: "#fcd34d", border: "1.5px solid rgba(245,158,11,0.42)" },
};

function Chip({ children, tone = "glass", size = 21 }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "9px 17px",
                borderRadius: 999,
                fontSize: size,
                fontWeight: 700,
                ...CHIP_TONES[tone],
            }}
        >
            {tone === "green" && (
                <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, backgroundColor: GREEN }} />
            )}
            {children}
        </div>
    );
}

function Cta({ children, size = 28 }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 18px 16px 32px",
                borderRadius: 999,
                backgroundImage: orangeFill,
                color: "white",
                fontSize: size,
                fontWeight: 900,
                letterSpacing: -0.3,
                boxShadow: "0 16px 40px rgba(249,115,22,0.42)",
            }}
        >
            {children}
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.22)",
                    fontSize: 32,
                    lineHeight: 1,
                    paddingBottom: 5,
                }}
            >
                ›
            </div>
        </div>
    );
}

/* Drawn when there's no photo: a warm tile with the initial. */
function PhotoPlaceholder({ letter }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: [
                    "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 45%)",
                    "linear-gradient(140deg, #fed7aa 0%, #fde68a 45%, #bbf7d0 100%)",
                ].join(", "),
            }}
        >
            <div
                style={{
                    width: 250,
                    height: 250,
                    borderRadius: 250,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.55)",
                    color: ORANGE_DEEP,
                    fontSize: 150,
                    fontWeight: 900,
                }}
            >
                {letter}
            </div>
        </div>
    );
}

function nameSize(text) {
    const length = text.length;

    if (length <= 12) {
        return 66;
    }

    if (length <= 18) {
        return 56;
    }

    if (length <= 26) {
        return 48;
    }

    return 42;
}

function priceSize(text, width) {
    // Inter Black is about 0.6 em per character.
    return Math.max(40, Math.min(78, Math.floor(width / (text.length * 0.6))));
}

/* =========================================================
   CARDS
========================================================= */

/*
 * card: {
 *   name, place, price, priceLabel, meta, ready, readyTone,
 *   fresh, delivery, cta, host, photo (data URL), photoCount,
 *   photoCountLabel, letter
 * }
 */
function ListingCard({ card }) {
    return (
        <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: "flex", position: "relative", fontFamily: "Inter, Inter Extended" }}>
            <Backdrop />

            {/* Photo, framed */}
            <div
                style={{
                    position: "absolute",
                    left: 46,
                    top: 48,
                    width: PHOTO_SIZE,
                    height: PHOTO_SIZE,
                    display: "flex",
                    overflow: "hidden",
                    borderRadius: 38,
                    border: "2px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
                    backgroundColor: "#1c2740",
                }}
            >
                {card.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={card.photo}
                        alt=""
                        width={PHOTO_SIZE}
                        height={PHOTO_SIZE}
                        style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, objectFit: "cover", borderRadius: 36 }}
                    />
                ) : (
                    <PhotoPlaceholder letter={card.letter} />
                )}

                {/* Soft shade at the bottom, for the badges. */}
                {card.photo && (
                    <div
                        style={{
                            position: "absolute",
                            left: 0,
                            bottom: 0,
                            width: PHOTO_SIZE,
                            height: 150,
                            display: "flex",
                            borderBottomLeftRadius: 36,
                            borderBottomRightRadius: 36,
                            backgroundImage: "linear-gradient(180deg, rgba(11,18,32,0) 0%, rgba(11,18,32,0.55) 100%)",
                        }}
                    />
                )}

                <div style={{ position: "absolute", left: 22, bottom: 22, width: PHOTO_SIZE - 44, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 16px",
                            borderRadius: 999,
                            backgroundColor: "rgba(11,18,32,0.74)",
                            color: "white",
                            fontSize: 19,
                            fontWeight: 800,
                        }}
                    >
                        <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, backgroundColor: ORANGE }} />
                        {card.delivery}
                    </div>

                    {card.photoCount > 1 && (
                        <div
                            style={{
                                display: "flex",
                                padding: "9px 16px",
                                borderRadius: 999,
                                backgroundColor: "rgba(11,18,32,0.74)",
                                color: "white",
                                fontSize: 19,
                                fontWeight: 800,
                            }}
                        >
                            {card.photoCountLabel}
                        </div>
                    )}
                </div>
            </div>

            {/* Details */}
            <div
                style={{
                    position: "absolute",
                    left: 626,
                    top: 54,
                    width: 528,
                    height: 524,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Brand label="MARCHÉ" />
                        <Host>{card.host}</Host>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
                        {card.ready && <Chip tone={card.readyTone}>{card.ready}</Chip>}
                        {card.fresh && <Chip tone="amber">{card.fresh}</Chip>}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            marginTop: 18,
                            color: "white",
                            fontSize: nameSize(card.name),
                            fontWeight: 900,
                            lineHeight: 1.04,
                            letterSpacing: -1.8,
                        }}
                    >
                        {card.name}
                    </div>

                    <div style={{ display: "flex", marginTop: 12, color: "rgba(255,255,255,0.7)", fontSize: 25, fontWeight: 500 }}>
                        {card.place}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", color: "rgba(255,255,255,0.55)", fontSize: 17, fontWeight: 800, letterSpacing: 2.5 }}>
                        {card.priceLabel}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            marginTop: 2,
                            fontSize: priceSize(card.price, 528),
                            fontWeight: 900,
                            letterSpacing: -2,
                            lineHeight: 1.08,
                            ...gradientText,
                        }}
                    >
                        {card.price}
                    </div>

                    <div style={{ display: "flex", marginTop: 6, color: "rgba(255,255,255,0.72)", fontSize: 22, fontWeight: 700 }}>
                        {card.meta}
                    </div>

                    <div style={{ display: "flex", marginTop: 24 }}>
                        <Cta>{card.cta}</Cta>
                    </div>
                </div>
            </div>
        </div>
    );
}

/*
 * card: { from, to, status, open, cargo, distance, weight,
 *         fresh, label, price, cta, host }
 */
function LoadCard({ card }) {
    const routeLength = card.from.length + card.to.length;

    const routeSize = routeLength <= 14 ? 96 : routeLength <= 20 ? 80 : routeLength <= 26 ? 64 : 52;

    return (
        <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: "flex", position: "relative", fontFamily: "Inter, Inter Extended" }}>
            <Backdrop />

            <div
                style={{
                    position: "absolute",
                    left: 66,
                    top: 58,
                    width: 1068,
                    height: 516,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Brand label="TRANSPORT" />
                    <Chip tone={card.open ? "green" : "glass"}>{card.status}</Chip>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ display: "flex", color: "white", fontSize: routeSize, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05 }}>
                            {card.from}
                        </div>

                        {/* The road: start ring, line, arrival dot. */}
                        <div style={{ display: "flex", alignItems: "center", flex: 1, margin: "0 26px", minWidth: 80 }}>
                            <div style={{ display: "flex", width: 20, height: 20, borderRadius: 20, border: `4px solid ${ORANGE}` }} />
                            <div style={{ display: "flex", flex: 1, height: 5, borderRadius: 5, backgroundImage: `linear-gradient(90deg, ${ORANGE}, ${AMBER} 55%, ${GREEN})` }} />
                            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 22, backgroundColor: GREEN, boxShadow: "0 0 0 7px rgba(34,197,94,0.22)" }} />
                        </div>

                        <div style={{ display: "flex", fontSize: routeSize, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, ...gradientText }}>
                            {card.to}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
                        <Chip size={23}>{card.cargo}</Chip>
                        {card.distance && <Chip size={23}>{card.distance}</Chip>}
                        {card.weight && <Chip size={23}>{card.weight}</Chip>}
                        {card.fresh && <Chip size={23} tone="amber">{card.fresh}</Chip>}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", color: "rgba(255,255,255,0.55)", fontSize: 18, fontWeight: 800, letterSpacing: 2.5 }}>
                            {card.label}
                        </div>
                        <div style={{ display: "flex", color: "white", fontSize: priceSize(card.price, 560), fontWeight: 900, letterSpacing: -2, lineHeight: 1.08 }}>
                            {card.price}
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16 }}>
                        <Cta>{card.cta}</Cta>
                        <Host>{card.host}</Host>
                    </div>
                </div>
            </div>
        </div>
    );
}

/*
 * card: { eyebrow, title, highlight, text, chips, cta, host }
 */
function SiteCard({ card }) {
    return (
        <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: "flex", position: "relative", fontFamily: "Inter, Inter Extended" }}>
            <Backdrop />

            <div
                style={{
                    position: "absolute",
                    left: 72,
                    top: 62,
                    width: 1056,
                    height: 508,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Brand label={card.eyebrow} />
                    <Host>{card.host}</Host>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", color: "white", fontSize: 72, fontWeight: 900, lineHeight: 1.02, letterSpacing: -3 }}>
                        {card.title}
                    </div>
                    <div style={{ display: "flex", fontSize: 72, fontWeight: 900, lineHeight: 1.08, letterSpacing: -3, ...gradientText }}>
                        {card.highlight}
                    </div>
                    <div style={{ display: "flex", marginTop: 22, maxWidth: 940, color: "rgba(255,255,255,0.72)", fontSize: 27, fontWeight: 500, lineHeight: 1.42 }}>
                        {card.text}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                        {card.chips.map((chip, index) => (
                            <Chip key={chip} tone={index === 0 ? "green" : "glass"}>{chip}</Chip>
                        ))}
                    </div>
                    <Cta>{card.cta}</Cta>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   RENDER
========================================================= */

const CARDS = { listing: ListingCard, load: LoadCard, site: SiteCard };

/*
 * Returns { body, type }: JPEG when sharp is available, PNG
 * otherwise. If the photo can't be drawn, the card is drawn
 * again without it.
 */
export async function renderCard(kind, card) {
    const Card = CARDS[kind] || SiteCard;

    const fonts = loadFonts();

    async function draw(data) {
        const image = new ImageResponse(<Card card={data} />, {
            width: OG_WIDTH,
            height: OG_HEIGHT,
            fonts: fonts.length ? fonts : undefined,
        });

        return Buffer.from(await image.arrayBuffer());
    }

    let png;

    try {
        png = await draw(card);
    } catch (error) {
        if (!card.photo) {
            throw error;
        }

        console.error("Preview drawn without photo:", error?.message);
        png = await draw({ ...card, photo: null });
    }

    const sharp = await getSharp();

    if (sharp) {
        try {
            const body = await sharp(png).jpeg({ quality: 88, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();

            return { body, type: "image/jpeg" };
        } catch (error) {
            console.error("Preview JPEG failed, sending PNG:", error?.message);
        }
    }

    return { body: png, type: "image/png" };
}
