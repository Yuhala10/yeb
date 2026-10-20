import Link from "next/link";
import { useState } from "react";

import { useFeedback } from "../../components/App/Feedback";
import Avatar from "../../components/Market/Avatar";
import FollowButton from "../../components/Market/FollowButton";
import { FeedIcon, GridIcon } from "../../components/Market/Icons";
import PostCard from "../../components/Market/PostCard";
import Seo from "../../components/Site/Seo";
import SiteFooter from "../../components/Site/SiteFooter";
import SiteHeader from "../../components/Site/SiteHeader";
import Icon from "../../components/Site/Icon";
import { languageName } from "../../lib/languages";
import { useLanguage } from "../../lib/LanguageContext";
import { formatMoney } from "../../lib/money";
import { productName, unitName } from "../../lib/produce";
import { listingCardUrl, localizedUrl, siteCardUrl, siteOrigin } from "../../lib/seo";
import { getProfile } from "../../lib/server/social";
import { countLabel, useSocialText } from "../../lib/socialText";
import { followerCount, useSocial } from "../../lib/useSocial";
import { useSession } from "../../lib/useSession";

/*
 * ============================================================
 * A FARM'S PAGE: tayeb…/farm/<handle>
 * ============================================================
 *
 * Like a profile on a social app: cover, photo, name, badges,
 * what the farm is about and the languages it speaks, its
 * numbers, Follow and Share, then every post (grid or feed).
 * Server-rendered so Google and WhatsApp previews see it.
 */

export async function getServerSideProps({ params, req, res, locale }) {
    let data = null;

    try {
        data = await getProfile(String(params.handle || ""), null);
    } catch (error) {
        if (error?.status !== 404 && error?.code !== "SOCIAL_NOT_READY") {
            console.error("Farm page error:", error);
        }
    }

    if (!data) {
        return { notFound: true };
    }

    // An old link with the id or another spelling: one address only.
    if (data.profile.handle && params.handle !== data.profile.handle) {
        return { redirect: { destination: `${locale === "en" ? "/en" : ""}/farm/${data.profile.handle}`, permanent: true } };
    }

    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");

    return {
        props: {
            profile: data.profile,
            posts: data.posts,
            origin: siteOrigin(req),
        },
    };
}

export default function FarmPage({ profile, posts, origin }) {
    const { language } = useLanguage();

    const s = useSocialText();

    const { toast } = useFeedback();

    const { user, loading } = useSession();

    const social = useSocial(user);

    const [view, setView] = useState("grid");

    const name = profile.farm_name || profile.full_name;

    const followers = followerCount(social, profile);

    const onSale = posts.filter((post) => post.visible);

    const path = `/farm/${profile.handle}`;

    const link = localizedUrl(origin, path, language);

    const description =
        profile.bio ||
        (language === "fr"
            ? `${name}, ferme à ${profile.base_city || "Cameroun"} sur Tayeb Marché. ${onSale.length} produits en vente : commandez directement à la ferme, livré par Tayeb.`
            : `${name}, a farm in ${profile.base_city || "Cameroon"} on Tayeb Marché. ${onSale.length} products for sale: order straight from the farm, delivered by Tayeb.`);

    const since = profile.member_since
        ? new Date(profile.member_since).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" })
        : null;

    async function share() {
        const text = s("sharePageText", { link });

        try {
            if (navigator.share) {
                await navigator.share({ title: name, text, url: link });
                return;
            }
        } catch {
            return;
        }

        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(link);
            toast(s("copied"), "success");
        } catch {
            // Clipboard blocked: the share button still works.
        }
    }

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name,
            url: link,
            description,
            ...(profile.avatar_url ? { logo: profile.avatar_url, image: profile.avatar_url } : {}),
            address: { "@type": "PostalAddress", addressLocality: profile.base_city || undefined, addressCountry: profile.country || "CM" },
            ...(profile.rating_count
                ? { aggregateRating: { "@type": "AggregateRating", ratingValue: profile.rating, reviewCount: profile.rating_count, bestRating: 5 } }
                : {}),
            makesOffer: onSale.slice(0, 20).map((post) => ({
                "@type": "Offer",
                url: localizedUrl(origin, `/market/${post.id}`, language),
                price: post.price_per_unit,
                priceCurrency: post.currency,
                itemOffered: { "@type": "Product", name: productName(post, language) },
            })),
        },
    ];

    return (
        <>
            <Seo
                origin={origin}
                path={path}
                title={`${name} (@${profile.handle}) · Tayeb Marché`}
                description={description.slice(0, 300)}
                image={onSale[0] ? listingCardUrl(origin, onSale[0], language) : siteCardUrl(origin, "market", language)}
                type="profile"
                structuredData={structuredData}
            />

            <div className="ts-page">
                <SiteHeader user={user} loading={loading} variant="dark" active="market" />

                <main className="sm-profile">

                    <div className={`sm-cover ${profile.cover_url ? "has-photo" : ""}`}>
                        {profile.cover_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.cover_url} alt="" />
                        )}
                    </div>

                    <div className="sm-profile-wrap">

                        <section className="sm-profile-card">
                            <div className="sm-profile-top">
                                <Avatar person={profile} size={104} ring className="sm-profile-avatar" />
                                <div className="sm-profile-stats">
                                    <div><strong>{posts.length}</strong><small>{language === "fr" ? "publications" : "posts"}</small></div>
                                    <div><strong>{followers}</strong><small>{language === "fr" ? "abonnés" : "followers"}</small></div>
                                    <div><strong>{profile.completed_sales || 0}</strong><small>{language === "fr" ? "ventes" : "sales"}</small></div>
                                </div>
                            </div>

                            <div className="sm-profile-name">
                                <h1>
                                    {name}
                                    {(profile.badges?.id || profile.badges?.visited) && <span className="sm-tick"><Icon name="check" size={11} stroke={3} /></span>}
                                </h1>
                                <span>@{profile.handle}{profile.farm_name && profile.full_name ? ` · ${profile.full_name}` : ""}</span>
                            </div>

                            <div className="sm-badges">
                                <span className="sm-badge"><Icon name="phoneMoney" /> {s("badgePhone")}</span>
                                {profile.badges?.id && <span className="sm-badge is-green"><Icon name="idCard" /> {s("badgeId")}</span>}
                                {profile.badges?.visited && <span className="sm-badge is-green"><Icon name="home" /> {s("badgeVisited")}</span>}
                                {profile.badges?.top && <span className="sm-badge is-gold"><Icon name="badge" /> {s("badgeTop")}</span>}
                                {profile.rating_count > 0 && <span className="sm-badge is-gold"><Icon name="star" /> {profile.rating} ({profile.rating_count})</span>}
                            </div>

                            {profile.bio && <p className="sm-bio">{profile.bio}</p>}

                            <div className="sm-profile-meta">
                                {profile.base_city && <span><Icon name="pin" /> {profile.base_city}, Cameroun</span>}
                                {profile.languages?.length > 0 && (
                                    <span><Icon name="language" /> {profile.languages.map((code) => languageName(code, language)).join(" · ")}</span>
                                )}
                                {since && <span><Icon name="sprout" /> {s("memberSince", { date: since })}</span>}
                            </div>

                            <div className="sm-profile-actions">
                                {user?.id === profile.id ? (
                                    <Link href="/farmer#profile" className="ts-btn ts-btn-light"><Icon name="edit" /> {s("editProfile")}</Link>
                                ) : (
                                    <FollowButton farmer={profile} user={user} size="lg" />
                                )}
                                <button type="button" className="ts-btn ts-btn-whatsapp" onClick={share}><Icon name="chat" /> {s("share")}</button>
                                <button type="button" className="ts-btn ts-btn-light sm-icon-btn" onClick={copy} aria-label={s("copied")}><Icon name="link" /></button>
                            </div>
                        </section>

                        <div className="sm-tabs" role="tablist">
                            <button type="button" role="tab" aria-selected={view === "grid"} className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>
                                <GridIcon /> {s("gridView")}
                            </button>
                            <button type="button" role="tab" aria-selected={view === "feed"} className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}>
                                <FeedIcon /> {s("feedView")}
                            </button>
                        </div>

                        {posts.length === 0 ? (
                            <div className="mk-empty">
                                <div className="mk-empty-icon"><Icon name="sprout" size={28} /></div>
                                <h3>{s("noPosts")}</h3>
                            </div>
                        ) : view === "grid" ? (
                            <div className="sm-grid">
                                {posts.map((post) => (
                                    <Link key={post.id} href={`/market/${post.id}`} className={`sm-tile ${post.visible ? "" : "is-off"}`}>
                                        {post.photos?.[0]?.url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={post.photos[0].url} alt={productName(post, language)} loading="lazy" decoding="async" />
                                        ) : (
                                            <span className="sm-tile-emoji" aria-hidden="true"><Icon name="image" size={28} stroke={1.4} /></span>
                                        )}
                                        <span className="sm-tile-info">
                                            <strong>{productName(post, language)}</strong>
                                            <small>{formatMoney(post.price_per_unit, post.currency)} / {unitName(post.unit, language)}</small>
                                        </span>
                                        {!post.visible && <span className="sm-tile-off">{s("soldOut")}</span>}
                                        {post.photos?.length > 1 && <span className="sm-tile-many" aria-hidden="true"><Icon name="copy" size={16} /></span>}
                                        {post.voice_url && <span className="sm-tile-voice" aria-hidden="true"><Icon name="mic" size={16} /></span>}
                                        {post.likes_count > 0 && <span className="sm-tile-likes"><Icon name="heart" size={12} fill /> {post.likes_count}</span>}
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="sm-feed">
                                {posts.map((post, index) => (
                                    <PostCard key={post.id} listing={{ ...post, farmer: post.farmer || profile }} user={user} eager={index === 0} />
                                ))}
                            </div>
                        )}

                        <p className="sm-small" style={{ textAlign: "center", margin: "24px 0 0" }}>
                            {countLabel(language, "posts", posts.length)} · {countLabel(language, "followers", followers)}
                        </p>
                    </div>
                </main>

                <SiteFooter />
            </div>
        </>
    );
}
