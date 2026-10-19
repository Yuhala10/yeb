import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import { BookmarkIcon, HeartIcon, ShareIcon } from "./Icons";
import VoiceNote from "./VoiceNote";
import { useFeedback } from "../App/Feedback";
import PhotoCarousel from "../Site/PhotoCarousel";
import { appText } from "../../lib/appText";
import { languageName } from "../../lib/languages";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, useMarketText } from "../../lib/marketText";
import { formatMoney } from "../../lib/money";
import { formatAmount, productEmoji, productName, unitName } from "../../lib/produce";
import { countLabel, socialError, socialText, useSocialText } from "../../lib/socialText";
import { likeCount, setLiked, setSaved, useSocial } from "../../lib/useSocial";
import { loginThenReturn } from "../../lib/useSession";

/*
 * ============================================================
 * ONE POST IN THE FEED
 * ============================================================
 *
 * Like a social post: the farm (photo, name, badges, place,
 * when), the photos (swipe; double-tap to like), like, share
 * and save, then the product, price, the farmer's caption in
 * their own language and their voice note, and "Order".
 */

function ago(value, language) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

    if (minutes < 1) {
        return appText(language, "justNow");
    }

    if (minutes < 60) {
        return appText(language, "minAgo", { n: minutes });
    }

    if (minutes < 48 * 60) {
        return appText(language, "hourAgo", { n: Math.round(minutes / 60) });
    }

    return new Date(value).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
}

export function shareListing(listing, language) {
    if (typeof window === "undefined") {
        return;
    }

    const link = `${window.location.origin}${language === "en" ? "/en" : ""}/market/${listing.id}`;

    const text = socialText(language, "shareListingText", {
        product: productName(listing, language),
        price: `${formatMoney(listing.price_per_unit, listing.currency)} / ${unitName(listing.unit, language)}`,
        link,
    });

    if (navigator.share) {
        navigator.share({ title: productName(listing, language), text, url: link }).catch(() => {});
        return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export default function PostCard({ listing, user, distanceKm = null, eager = false }) {
    const router = useRouter();

    const { language } = useLanguage();

    const s = useSocialText();

    const m = useMarketText();

    const { toast } = useFeedback();

    const social = useSocial(user);

    const [open, setOpen] = useState(false);

    const [burst, setBurst] = useState(0);

    const farmer = listing.farmer || {};

    const liked = social.likes.has(listing.id);

    const saved = social.saves.has(listing.id);

    const likes = likeCount(social, listing);

    const name = farmer.farm_name || farmer.full_name || "";

    const farmHref = farmer.handle ? `/farm/${farmer.handle}` : null;

    const caption = String(listing.details || "").trim();

    const long = caption.length > 150;

    function needLogin() {
        if (user) {
            return false;
        }

        loginThenReturn(router, "SHIPPER", router.asPath);

        return true;
    }

    async function like(on) {
        if (needLogin()) {
            return;
        }

        try {
            await setLiked(listing, on);
        } catch (error) {
            toast(socialError(language, error), "error");
        }
    }

    async function save() {
        if (needLogin()) {
            return;
        }

        try {
            await setSaved(listing, !saved);
        } catch (error) {
            toast(socialError(language, error), "error");
        }
    }

    function doubleTap() {
        setBurst(Date.now());

        if (!liked) {
            like(true);
        }
    }

    const Who = farmHref ? Link : "div";

    return (
        <article className="sm-post">

            {/* ---------------- the farm ---------------- */}

            <header className="sm-post-head">
                <Who {...(farmHref ? { href: farmHref } : {})} className="sm-who">
                    <Avatar person={farmer} size={42} ring />
                    <span className="sm-who-text">
                        <strong>
                            {name}
                            {(farmer.verified || farmer.visited) && <span className="sm-tick" title={s(farmer.visited ? "badgeVisited" : "badgeId")}>✓</span>}
                        </strong>
                        {/* "5 min ago" is worked out again in the browser: it may differ by a minute. */}
                        <small suppressHydrationWarning>
                            📍 {listing.area ? `${listing.area}, ` : ""}{listing.city}
                            {distanceKm !== null ? ` · ~${distanceKm} km` : ""} · {ago(listing.created_at, language)}
                        </small>
                    </span>
                </Who>
                <FollowButton farmer={farmer} user={user} />
            </header>

            {/* ---------------- photos ---------------- */}

            <div className="sm-media" onDoubleClick={doubleTap}>
                <PhotoCarousel photos={listing.photos || []} alt={productName(listing, language)} emoji={productEmoji(listing.product)} thumbs={false} eager={eager}>
                    <span className="sm-price-tag">
                        {formatMoney(listing.price_per_unit, listing.currency)} <small>/ {unitName(listing.unit, language)}</small>
                    </span>
                    {listing.visible === false ? (
                        <span className="sm-state is-off">{s("soldOut")}</span>
                    ) : listing.ready_now ? (
                        <span className="sm-state">✓ {m("readyNow")}</span>
                    ) : (
                        <span className="sm-state is-later">🗓️ {m("readyOn", { date: formatDay(listing.available_from, language) })}</span>
                    )}
                    {burst > 0 && <span key={burst} className="sm-burst" aria-hidden="true">♥</span>}
                </PhotoCarousel>
            </div>

            {/* ---------------- actions ---------------- */}

            <div className="sm-actions">
                <button type="button" className={`sm-act ${liked ? "is-liked" : ""}`} onClick={() => like(!liked)} aria-pressed={liked} aria-label={liked ? s("unlike") : s("like")}>
                    <HeartIcon filled={liked} />
                    {likes > 0 && <b>{likes}</b>}
                </button>
                <button type="button" className="sm-act" onClick={() => shareListing(listing, language)} aria-label={s("share")}>
                    <ShareIcon />
                </button>
                {listing.voice_url && <VoiceNote url={listing.voice_url} seconds={listing.voice_seconds} />}
                <span className="sm-grow" />
                <button type="button" className={`sm-act ${saved ? "is-saved" : ""}`} onClick={save} aria-pressed={saved} aria-label={saved ? s("unsave") : s("save")}>
                    <BookmarkIcon filled={saved} />
                </button>
            </div>

            {/* ---------------- product, caption, order ---------------- */}

            <div className="sm-body">
                <Link href={`/market/${listing.id}`} className="sm-title">
                    {productEmoji(listing.product)} {productName(listing, language)}
                </Link>

                {likes > 1 && <span className="sm-likes">{countLabel(language, "likes", likes)}</span>}

                {caption && (
                    <p className={`sm-caption ${open || !long ? "is-open" : ""}`} lang={listing.caption_lang || undefined}>
                        <strong>{farmer.handle ? `@${farmer.handle}` : name}</strong> {caption}
                        {long && !open && (
                            <button type="button" className="sm-more" onClick={() => setOpen(true)}>
                                … {s("more")}
                            </button>
                        )}
                    </p>
                )}

                {listing.caption_lang && listing.caption_lang !== "fra" && listing.caption_lang !== "eng" && (
                    <span className="sm-lang">🗣️ {s("inLanguage", { lang: languageName(listing.caption_lang, language) })}</span>
                )}

                <div className="sm-buy">
                    <span>
                        {listing.visible === false
                            ? s("soldOut")
                            : s("available", {
                                quantity: formatAmount(listing.quantity_available),
                                unit: unitName(listing.unit, language, listing.quantity_available),
                            })}
                        {farmer.rating_count ? ` · ★ ${farmer.rating}` : ""}
                    </span>
                    {listing.visible !== false && (
                        <Link href={`/market/${listing.id}`} className="ts-btn ts-btn-primary ts-btn-sm">
                            🛒 {s("order")}
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
}
