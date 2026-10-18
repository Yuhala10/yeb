import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { DeliverySteps, Person, timeAgo } from "../../components/App/Bits";
import { useFeedback } from "../../components/App/Feedback";
import { apiGet, pollWhileVisible } from "../../lib/api";
import { useAppText } from "../../lib/appText";
import { cargoEmoji, cargoLabel } from "../../lib/cargo";
import { useLanguage } from "../../lib/LanguageContext";
import { formatMoney } from "../../lib/money";
import { formatPhone, telHref, whatsappHref } from "../../lib/phone";
import { DASHBOARDS } from "../../lib/useSession";
import { useLiveLocation } from "../../lib/useLiveLocation";

/*
 * ============================================================
 * LIVE TRACKING
 * ============================================================
 *
 * /track/<load id>             shipper, driver, staff (signed in)
 * /track/<load id>?t=<token>   the receiver, from the private link
 *
 * The map fills the screen; the panel (a sheet on phones) says
 * where the goods are, when they arrive, and how the trip went.
 * Refreshes every 10 seconds. The driver's own phone position
 * is shown instantly and shared from this page too.
 */

const TripMap = dynamic(() => import("../../components/Map/TripMap"), { ssr: false });

const SHARING = ["MATCHED", "DEPARTED"];

function duration(minutes, a) {
    if (minutes < 60) {
        return a("tk_minutes", { n: Math.max(1, minutes) });
    }

    const hours = Math.floor(minutes / 60);

    const rest = String(minutes % 60).padStart(2, "0");

    return a("tk_hours", { h: hours, m: rest });
}

/*
 * Keeps the route clear of the panel: a sheet at the bottom
 * on phones, a column on the left on larger screens.
 */
function mapPadding(small) {
    if (typeof window === "undefined") {
        return { top: 90, right: 40, bottom: 40, left: 40 };
    }

    if (window.innerWidth <= 760) {
        const sheet = small ? 210 : Math.round(window.innerHeight * 0.62);

        return { top: 84, right: 28, bottom: sheet + 16, left: 28 };
    }

    return { top: 96, right: 70, bottom: 50, left: Math.min(460, window.innerWidth * 0.45) };
}

function clock(iso, language) {
    const date = new Date(iso);

    const sameDay = new Date().toDateString() === date.toDateString();

    const locale = language === "fr" ? "fr-FR" : "en-GB";

    const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

    return sameDay ? time : `${date.toLocaleDateString(locale, { weekday: "short", day: "numeric" })} ${time}`;
}

export default function TrackPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const { toast } = useFeedback();

    const id = typeof router.query.id === "string" ? router.query.id : null;

    const token = typeof router.query.t === "string" ? router.query.t : null;

    const [data, setData] = useState(null);

    const [missing, setMissing] = useState(false);

    const [follow, setFollow] = useState(true);

    const [recenter, setRecenter] = useState(0);

    const [small, setSmall] = useState(false);

    /* ---------------- data ---------------- */

    useEffect(() => {
        if (!id) {
            return;
        }

        async function load() {
            try {
                const result = await apiGet(`/api/track?id=${encodeURIComponent(id)}${token ? `&t=${encodeURIComponent(token)}` : ""}`);

                setData(result);
                setMissing(false);
            } catch (error) {
                if (error?.status === 404 || error?.status === 400) {
                    setMissing(true);
                }
            }
        }

        return pollWhileVisible(load, 10000);
    }, [id, token]);

    const isDriver = data?.viewer === "driver";

    const sharing = useLiveLocation(isDriver ? id : null, isDriver && SHARING.includes(data?.shipment?.status));

    /* ---------------- what to draw ---------------- */

    const trip = data?.trip;

    // The driver sees their own phone's position right away.
    const own = isDriver && sharing.state === "on" && sharing.position ? sharing.position : null;

    const truck = useMemo(() => {
        if (own) {
            return { lat: own.lat, lng: own.lng, accuracy: own.accuracy };
        }

        return data?.last ? { lat: data.last.lat, lng: data.last.lng, accuracy: data.last.accuracy } : null;
    }, [own, data]);

    const heading = own && own.heading !== null && !Number.isNaN(own.heading) ? own.heading : trip?.heading ?? null;

    const trail = useMemo(() => data?.trail || [], [data]);

    /* ---------------- screens ---------------- */

    if (missing) {
        return (
            <main className="ap-loading" style={{ padding: 24 }}>
                <Head>
                    <title>{`${a("tk_notFound")} · Tayeb`}</title>
                    <meta name="robots" content="noindex" />
                </Head>
                <div style={{ display: "grid", justifyItems: "center", gap: 14, textAlign: "center", maxWidth: 440 }}>
                    <span className="ap-eyebrow">🛰️ {a("tk_title")}</span>
                    <h1 style={{ margin: 0, color: "white", fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em" }}>{a("tk_notFound")}</h1>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>{a("tk_notFoundText")}</p>
                    <Link href="/" className="ts-btn ts-btn-primary">🏠 Tayeb</Link>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="ap-loading" aria-busy="true">
                <Head>
                    <title>{`${a("tk_title")} · Tayeb`}</title>
                    <meta name="robots" content="noindex" />
                </Head>
                <div className="ap-loading-mark">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/branding/tayeb-logo.jpeg" alt="Tayeb" width={72} height={72} />
                    <span>🛰️ {a("tk_title")}…</span>
                </div>
            </main>
        );
    }

    const { shipment, viewer, driver } = data;

    const isPublic = viewer === "public";

    const back = isPublic ? "/" : viewer === "admin" ? "/admin" : DASHBOARDS[viewer === "driver" ? "DRIVER" : "SHIPPER"];

    const cityName = trip.target?.name || shipment.destination_city;

    const phaseKey = trip.phase === "TO_PICKUP" && isPublic ? "tk_phase_TO_PICKUP_public" : `tk_phase_${trip.phase}`;

    const headline = a(phaseKey, { city: cityName });

    const cargo = `${shipment.quantity} × ${cargoLabel(shipment.item_type, language)}`;

    const signal = own ? "live" : trip.signal;

    const signalText = {
        live: a("tk_live"),
        recent: timeAgo(data.last?.at, language, a),
        stale: a("tk_lost", { when: timeAgo(data.last?.at, language, a) }),
        none: a("tk_noSignal"),
    }[signal];

    const moving = trip.phase === "TO_DESTINATION" || trip.phase === "TO_PICKUP";

    const link = typeof window !== "undefined" && data.token
        ? `${window.location.origin}${language === "en" ? "/en" : ""}/track/${shipment.id}?t=${data.token}`
        : null;

    const shareMessage = link ? a("tk_shareMessage", { item: cargo, link }) : "";

    const navTarget = trip.target ? `${trip.target.lat},${trip.target.lng}` : null;

    const events = [
        ["tk_ev_posted", shipment.created_at],
        ["tk_ev_matched", shipment.matched_at],
        ["tk_ev_departed", shipment.departed_at],
        ["tk_ev_arrived", shipment.arrived_at],
        ["tk_ev_completed", shipment.completed_at],
    ];

    async function copy() {
        try {
            await navigator.clipboard.writeText(link);
            toast(a("tk_copied"), "success");
        } catch {
            window.prompt(a("tk_copy"), link);
        }
    }

    return (
        <>
            <Head>
                <title>{`${headline} · Tayeb`}</title>
                <meta name="robots" content="noindex, nofollow" />
                {/* Map servers see "tayeb.app", never the private link. */}
                <meta name="referrer" content="strict-origin" />
            </Head>

            <main className="tk-page">

                <TripMap
                    from={data.from}
                    to={data.to}
                    trail={trail}
                    truck={truck}
                    heading={heading}
                    phase={trip.phase}
                    follow={follow}
                    recenter={recenter}
                    padding={mapPadding(small)}
                    label={headline}
                />

                {/* =============================================
                    TOP BAR
                ============================================= */}

                <div className="tk-bar">
                    <Link href={back} className="tk-round" aria-label="Tayeb">←</Link>
                    <div className="tk-title">
                        <strong>{cargoEmoji(shipment.item_type, shipment.is_produce)} {shipment.origin_city} → {shipment.destination_city}</strong>
                        <span className={`tk-signal is-${signal}`}>{signalText}</span>
                    </div>
                    {truck && (
                        <button
                            type="button"
                            className={`tk-round ${follow ? "is-on" : ""}`}
                            onClick={() => setFollow((current) => !current)}
                            aria-pressed={follow}
                            aria-label={a("tk_follow")}
                            title={a("tk_follow")}
                        >
                            ◎
                        </button>
                    )}
                    <button type="button" className="tk-round" onClick={() => { setFollow(false); setRecenter((count) => count + 1); }} aria-label={a("tk_fit")} title={a("tk_fit")}>
                        ⤢
                    </button>
                </div>


                {/* =============================================
                    PANEL
                ============================================= */}

                <aside className={`tk-side ${small ? "is-small" : ""}`} aria-label={a("tk_title")}>

                    <button
                        type="button"
                        className="tk-handle"
                        onClick={() => {
                            setSmall((current) => !current);
                            setRecenter((count) => count + 1);
                        }}
                        aria-label={a("tk_title")}
                        aria-expanded={!small}
                    />

                    <div className="tk-scroll">

                        <div>
                            <span className="ap-label">🛰️ {a("tk_title")}</span>
                            <h1 className="ap-card-title" style={{ fontSize: 22, marginTop: 4 }}>{headline}</h1>
                            <div className="ap-card-sub">{cargo}</div>
                        </div>

                        {/* Arrival and progress */}
                        {moving && trip.eta && truck ? (
                            <div className="tk-eta">
                                <small>{trip.phase === "TO_PICKUP" ? a("tk_etaPickupLabel") : a("tk_etaLabel")}</small>
                                <strong>
                                    {trip.eta_minutes === 0 ? a("tk_arriving") : clock(trip.eta, language)}
                                </strong>
                                <span>
                                    {trip.eta_minutes > 0 && a("tk_in", { duration: duration(trip.eta_minutes, a) })}
                                    {trip.km_left !== null && ` · ${a("tk_kmLeft", { km: trip.km_left })}`}
                                </span>
                                {trip.phase === "TO_DESTINATION" && trip.km_total > 0 && (
                                    <div className="tk-progress">
                                        <div className="tk-progress-bar"><i style={{ width: `${Math.round(trip.progress * 100)}%` }} /></div>
                                        <div className="tk-progress-legend">
                                            <span>{shipment.origin_city}</span>
                                            <span>{a("tk_ofTotal", { percent: Math.round(trip.progress * 100), km: trip.km_total })}</span>
                                            <span>{shipment.destination_city}</span>
                                        </div>
                                    </div>
                                )}
                                {signal !== "live" && <span style={{ fontSize: 12.5, opacity: 0.8 }}>{a("tk_estimated")}</span>}
                            </div>
                        ) : null}

                        {shipment.status !== "OPEN" && <DeliverySteps status={shipment.status === "CANCELLED" ? "MATCHED" : shipment.status} />}

                        {/* Alerts */}
                        {trip.away && (
                            <div className="ap-note ap-note-orange">
                                <span aria-hidden="true">🧭</span>
                                <span>{a("tk_away", { city: cityName })}</span>
                            </div>
                        )}

                        {moving && signal === "stale" && (
                            <div className="ap-note ap-note-red">
                                <span aria-hidden="true">📡</span>
                                <span>{a("tk_stale")}</span>
                            </div>
                        )}

                        {moving && !truck && (
                            <div className="ap-note ap-note-blue">
                                <span aria-hidden="true">📡</span>
                                <span>{a("tk_waitingPosition")}</span>
                            </div>
                        )}

                        {/* Live readings */}
                        {truck && data.live && (
                            <div className="ap-kv">
                                <div>
                                    <small>{a("tk_speed")}</small>
                                    <strong>
                                        {trip.moving === false && trip.stopped_minutes !== null
                                            ? a("tk_stopped", { n: trip.stopped_minutes })
                                            : trip.speed_kmh !== null
                                                ? `${trip.speed_kmh} km/h`
                                                : "—"}
                                    </strong>
                                </div>
                                {trip.near && (
                                    <div>
                                        <small>{a("tk_near")}</small>
                                        <strong>{trip.near.km <= 3 ? trip.near.name : a("tk_nearValue", { km: trip.near.km, city: trip.near.name })}</strong>
                                    </div>
                                )}
                                <div>
                                    <small>{a("tk_lastFix")}</small>
                                    <strong>{own ? a("tk_live") : timeAgo(data.last?.at, language, a)}</strong>
                                </div>
                                {(own?.accuracy || data.last?.accuracy) > 0 && (
                                    <div>
                                        <small>{a("tk_accuracy")}</small>
                                        <strong>± {Math.round(own?.accuracy || data.last.accuracy)} m</strong>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Driver */}
                        {driver && (
                            <div className="ap-card" style={{ padding: 14 }}>
                                <div className="ap-row">
                                    <Person
                                        name={driver.name}
                                        detail={[a("tk_driver"), driver.vehicle_type, driver.plate_number, driver.rating_count ? `★ ${driver.rating}` : null].filter(Boolean).join(" · ")}
                                    />
                                    {driver.phone && viewer !== "driver" && (
                                        <a className="ts-btn ts-btn-light ts-btn-sm" href={telHref(driver.phone)}>
                                            📞 {a("tk_call")}
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Driver: navigation and sharing */}
                        {isDriver && navTarget && moving && (
                            <div className="ap-stack" style={{ gap: 10 }}>
                                <a
                                    className="ts-btn ts-btn-primary"
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${navTarget}&travelmode=driving`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    🧭 {a("tk_navigate")}
                                </a>
                                <div className={`ap-note ${sharing.state === "on" ? "ap-note-green" : "ap-note-orange"}`} style={{ display: "grid", gap: 8 }}>
                                    <span>
                                        📡 {sharing.state === "on" ? a("tk_sharing") : sharing.state === "denied" ? a("d_trackingBlocked") : a("d_trackingOff")}
                                    </span>
                                    {sharing.state !== "on" && (
                                        <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={sharing.retry}>📡 {a("d_shareLocation")}</button>
                                    )}
                                    {sharing.state === "on" && <span className="tk-wake">🔆 {a("tk_screenOn")}</span>}
                                </div>
                                {shipment.shipper_phone && (
                                    <a className="ts-btn ts-btn-light ts-btn-sm" href={telHref(shipment.shipper_phone)}>
                                        📞 {a("d_callShipper")} · {formatPhone(shipment.shipper_phone)}
                                    </a>
                                )}
                                {shipment.receiver_phone && (
                                    <a className="ts-btn ts-btn-light ts-btn-sm" href={telHref(shipment.receiver_phone)}>
                                        📞 {a("d_callReceiver")} · {formatPhone(shipment.receiver_phone)}
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Shipper: share with the receiver */}
                        {link && data.live && (
                            <div className="ap-card is-tint-green" style={{ padding: 14 }}>
                                <div>
                                    <strong style={{ color: "var(--ts-ink)" }}>🔗 {a("tk_shareTitle")}</strong>
                                    <div className="ap-card-sub">{a("tk_shareText")}</div>
                                </div>
                                <div className="ap-actions">
                                    <a
                                        className="ts-btn ts-btn-whatsapp ts-btn-sm"
                                        href={`${shipment.receiver_phone ? whatsappHref(shipment.receiver_phone) : "https://wa.me/"}?text=${encodeURIComponent(shareMessage)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        💬 {a("tk_shareWhatsApp")}
                                    </a>
                                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={copy}>
                                        🔗 {a("tk_copy")}
                                    </button>
                                </div>
                                {shipment.delivery_code && (
                                    <div className="ap-row">
                                        <span className="ap-card-sub">🔑 {a("s_codeTitle")}</span>
                                        <strong style={{ color: "var(--ts-ink)", letterSpacing: "0.3em", fontSize: 20 }}>{shipment.delivery_code}</strong>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timeline */}
                        <div>
                            <span className="ap-label">{a("tk_timeline")}</span>
                            <ol className="tk-timeline" style={{ marginTop: 10 }}>
                                {events.map(([key, at]) => (
                                    <li key={key} className={at ? "done" : ""}>
                                        <i aria-hidden="true" />
                                        <span>{a(key)}</span>
                                        <time>{at ? clock(at, language) : ""}</time>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {!isPublic && shipment.agreed_price > 0 && (
                            <div className="ap-row">
                                <span className="ap-card-sub">{a("tk_price")}</span>
                                <strong style={{ color: "var(--ts-ink)" }}>{formatMoney(shipment.agreed_price, shipment.currency)}</strong>
                            </div>
                        )}

                        {isPublic && (
                            <p className="ap-card-sub" style={{ textAlign: "center", margin: 0 }}>
                                <Link href="/" className="ts-link">Tayeb</Link> · {a("tk_publicNote")}
                            </p>
                        )}

                    </div>
                </aside>

            </main>
        </>
    );
}
