import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AccountPanel from "../components/App/AccountPanel";
import AppShell from "../components/App/AppShell";
import { AppLoading, DeliverySteps, digits, Empty, Person, Route, SectionHead, Sheet, splitPlace, timeAgo } from "../components/App/Bits";
import { useFeedback } from "../components/App/Feedback";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { appError, useAppText } from "../lib/appText";
import { cargoEmoji, cargoLabel } from "../lib/cargo";
import { cityNames, distanceKm } from "../lib/cities";
import { countryOrDefault } from "../lib/countries";
import { useLanguage } from "../lib/LanguageContext";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref } from "../lib/phone";
import { inviteShippersOnWhatsApp } from "../lib/shareLoad";
import { leaveDashboard, useRoleUser } from "../lib/useSession";

/*
 * ============================================================
 * DRIVER
 * ============================================================
 *
 * Loads ranked for this driver (return trips, then loads
 * leaving their city), their offers and counter-offers, the
 * deliveries they're doing (with live location and the
 * receiver's code), and their profile. Refreshes every 20
 * seconds while open.
 */

const LIVE = ["MATCHED", "DEPARTED", "ARRIVED"];

export default function DriverPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const { toast, confirm } = useFeedback();

    const [user, setUser] = useRoleUser("DRIVER");

    const [data, setData] = useState(null);

    const [tab, setTab] = useState("loads");

    const [offerFor, setOfferFor] = useState(null);

    const [counterFor, setCounterFor] = useState(null);

    const [busy, setBusy] = useState(null);

    const [tracking, setTracking] = useState("idle");

    const [trackingAttempt, setTrackingAttempt] = useState(0);

    /* =========================================================
       DATA
    ========================================================= */

    /*
     * A driver who opened /load/[id] from WhatsApp lands here
     * with that load's price form already open.
     */
    function openSharedLoad(result) {
        let pending = null;

        try {
            pending = localStorage.getItem("tayebPendingLoad");
            localStorage.removeItem("tayebPendingLoad");
        } catch {
            return;
        }

        const shipment = (result.shipments || []).find((item) => item.status === "OPEN" && String(item.id) === pending);

        if (shipment) {
            setTab("loads");
            setOfferFor({ shipment, bid: (result.bids || []).find((bid) => bid.shipment_id === shipment.id) });
            return;
        }

        // Straight to the delivery in progress, if there is one.
        if ((result.shipments || []).some((item) => item.driver_id === result.user?.id && LIVE.includes(item.status))) {
            setTab("trips");
        }
    }

    async function load(first = false) {
        try {
            const result = await apiGet("/api/driver");

            setData(result);
            setUser(result.user);

            if (first) {
                openSharedLoad(result);
            }
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                leaveDashboard(router, "DRIVER");
            }
        }
    }

    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        let first = true;

        return pollWhileVisible(() => {
            load(first);
            first = false;
        }, 20000);
        // load only sets state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    /* =========================================================
       GROUPS
    ========================================================= */

    const shipments = useMemo(() => data?.shipments || [], [data]);

    const bids = useMemo(() => data?.bids || [], [data]);

    const bidFor = useMemo(() => new Map(bids.map((bid) => [bid.shipment_id, bid])), [bids]);

    const openLoads = shipments.filter((item) => item.status === "OPEN" && item.driver_id !== userId);

    const myJobs = shipments.filter((item) => item.driver_id === userId);

    const activeJobs = myJobs.filter((item) => LIVE.includes(item.status));

    const doneJobs = myJobs.filter((item) => item.status === "COMPLETED");

    const byId = new Map(shipments.map((item) => [item.id, item]));

    const isCounter = (bid) => bid?.status === "COUNTERED" && bid.last_offer_by === "SHIPPER" && bid.counter_price;

    const counters = bids.filter((bid) => isCounter(bid) && byId.get(bid.shipment_id)?.status === "OPEN");

    const earned = doneJobs.reduce((sums, job) => {
        const code = job.currency || countryOrDefault(user?.country).currency;
        sums[code] = (sums[code] || 0) + Number(job.agreed_price || 0);
        return sums;
    }, {});

    const earnedText = Object.entries(earned).map(([code, total]) => formatMoney(total, code)).join(" · ");

    /* =========================================================
       ACTIONS
    ========================================================= */

    async function run(key, action, success) {
        setBusy(key);

        try {
            const result = await action();

            if (success) {
                toast(success, "success");
            }

            await load();

            return result || true;
        } catch (error) {
            if (error?.status === 401) {
                leaveDashboard(router, "DRIVER");
                return false;
            }

            toast(appError(language, error), "error");
            await load();

            return false;
        } finally {
            setBusy(null);
        }
    }

    async function sendOffer({ shipment, price, eta, note }) {
        const done = await run("offer", () => apiPost("/api/driver", { action: "offer", shipmentId: shipment.id, price, eta, note }), a("d_offerSent"));

        if (done) {
            setOfferFor(null);
        }
    }

    async function sendCounter({ bid, price }) {
        const done = await run("counter", () => apiPost("/api/driver", { action: "counter", bidId: bid.id, price }), a("d_counterSent"));

        if (done) {
            setCounterFor(null);
        }
    }

    async function acceptCounter(bid, shipment) {
        const price = formatMoney(bid.counter_price, shipment?.currency);

        if (!(await confirm({ title: a("d_acceptTitle", { price }), text: a("d_acceptText"), confirmLabel: a("d_accept", { price }), icon: "🤝" }))) {
            return;
        }

        const done = await run(bid.id, () => apiPost("/api/driver", { action: "acceptCounter", bidId: bid.id }), a("d_accepted"));

        if (done) {
            setTab("trips");
        }
    }

    async function updateProfile(changes, success) {
        setBusy("profile");

        try {
            const result = await apiPost("/api/driver", { action: "profile", ...changes });

            setUser(result.user);
            toast(success, "success");

            if (changes.baseCity !== undefined) {
                await load();
            }
        } catch (error) {
            toast(appError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    async function setStatus(job, status, deliveryCode) {
        if (status === "DEPARTED" && !(await confirm({ title: a("d_startTitle"), text: a("d_startText"), confirmLabel: a("d_start"), icon: "🚚" }))) {
            return false;
        }

        return run(job.id, () => apiPost("/api/driver", { action: "status", shipmentId: job.id, status, deliveryCode }), status === "COMPLETED" ? a("d_delivered") : null);
    }

    /* =========================================================
       LIVE LOCATION
    =========================================================
     *
     * While goods are on the road (DEPARTED) and this page is
     * open, the phone's position goes to the shipper: at most
     * once a minute, or sooner after 300 m.
     */

    const roadJobId = activeJobs.find((item) => item.status === "DEPARTED")?.id;

    useEffect(() => {
        if (!roadJobId || typeof navigator === "undefined" || !navigator.geolocation) {
            return;
        }

        let lastSentAt = 0;
        let lastPoint = null;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setTracking("on");

                const point = { lat: position.coords.latitude, lng: position.coords.longitude };

                const moved = lastPoint ? distanceKm(lastPoint, point) : Infinity;

                if (Date.now() - lastSentAt < 60000 && moved < 0.3) {
                    return;
                }

                lastSentAt = Date.now();
                lastPoint = point;

                apiPost("/api/driver", {
                    action: "location",
                    shipmentId: roadJobId,
                    lat: point.lat,
                    lng: point.lng,
                    accuracy: position.coords.accuracy,
                }).catch(() => {});
            },
            (error) => setTracking(error.code === error.PERMISSION_DENIED ? "denied" : "idle"),
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [roadJobId, trackingAttempt]);

    /* =========================================================
       SCREEN
    ========================================================= */

    if (!user || !data) {
        return <AppLoading />;
    }

    const available = user.is_available ?? true;

    const tabs = [
        { key: "loads", label: a("d_tabLoads"), icon: "📦", count: openLoads.length },
        { key: "offers", label: a("d_tabOffers"), icon: "💬", count: counters.length },
        { key: "trips", label: a("d_tabTrips"), icon: "🚚", count: activeJobs.length },
        { key: "profile", label: a("d_tabProfile"), icon: "👤" },
    ];

    return (
        <AppShell
            user={user}
            eyebrow={`${a("role_DRIVER")}${user.base_city ? ` · 📍 ${user.base_city}` : ""}`}
            title={<>{a("helloWord")}, <em>{firstName(user.full_name)}</em></>}
            subtitle={a("d_sub")}
            actions={
                <button
                    type="button"
                    className="ts-btn ts-btn-glass"
                    onClick={() => updateProfile({ available: !available }, available ? a("d_nowHidden") : a("d_nowAvailable"))}
                    disabled={busy === "profile"}
                    aria-pressed={available}
                >
                    <span className="ts-pulse" aria-hidden="true" style={{ background: available ? "#4ade80" : "#94a3b8" }} />
                    {a("d_available")}
                    <span className={`ap-switch ${available ? "on" : ""}`} aria-hidden="true" style={{ transform: "scale(0.8)" }} />
                </button>
            }
            stats={[
                { value: openLoads.length, label: a("d_statOpen") },
                { value: counters.length, label: a("d_statOffers"), hot: counters.length > 0 },
                { value: activeJobs.length, label: a("d_statTrips"), hot: activeJobs.length > 0 },
                { value: doneJobs.length, label: a("d_statDone") },
            ]}
            tabs={tabs}
            tab={tab}
            onTab={setTab}
        >

            {/* =================================================
                LOADS
            ================================================= */}

            {tab === "loads" && (
                <section className="ap-section ap-fade">
                    <SectionHead title={a("d_loadsTitle")} sub={a("d_loadsSub")} />

                    {openLoads.length === 0 ? (
                        <Empty icon="🛣️" title={a("d_noLoads")} text={a("d_noLoadsText")}>
                            <button type="button" className="ts-btn ts-btn-whatsapp" onClick={() => inviteShippersOnWhatsApp(language)}>
                                💬 {a("d_invite")}
                            </button>
                        </Empty>
                    ) : (
                        <div className="ap-grid">
                            {openLoads.map((load) => (
                                <LoadCard
                                    key={load.id}
                                    load={load}
                                    bid={bidFor.get(load.id)}
                                    busy={busy}
                                    onOffer={() => setOfferFor({ shipment: load, bid: bidFor.get(load.id) })}
                                    onAccept={(bid) => acceptCounter(bid, load)}
                                    onCounter={(bid) => setCounterFor({ shipment: load, bid })}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}


            {/* =================================================
                OFFERS
            ================================================= */}

            {tab === "offers" && (
                <section className="ap-section ap-fade">
                    <SectionHead title={a("d_offersTitle")} count={counters.length} />

                    {bids.length === 0 ? (
                        <Empty icon="💬" title={a("d_noOffers")} text={a("d_noOffersText")}>
                            <button type="button" className="ts-btn ts-btn-primary" onClick={() => setTab("loads")}>
                                📦 {a("d_loadsTitle")}
                            </button>
                        </Empty>
                    ) : (
                        <div className="ap-grid">
                            {[...bids]
                                .sort((x, y) => Number(Boolean(isCounter(y))) - Number(Boolean(isCounter(x))))
                                .map((bid) => (
                                    <OfferCard
                                        key={bid.id}
                                        bid={bid}
                                        shipment={byId.get(bid.shipment_id)}
                                        busy={busy}
                                        onAccept={() => acceptCounter(bid, byId.get(bid.shipment_id))}
                                        onCounter={() => setCounterFor({ shipment: byId.get(bid.shipment_id), bid })}
                                        onChange={() => setOfferFor({ shipment: byId.get(bid.shipment_id), bid })}
                                    />
                                ))}
                        </div>
                    )}
                </section>
            )}


            {/* =================================================
                DELIVERIES
            ================================================= */}

            {tab === "trips" && (
                <>
                    <section className="ap-section ap-fade">
                        <SectionHead title={a("d_tripsTitle")} count={activeJobs.length} />

                        {activeJobs.length === 0 ? (
                            <Empty icon="🚚" title={a("d_noTrips")} text={a("d_noTripsText")} />
                        ) : (
                            <div className="ap-stack">
                                {activeJobs.map((job) => (
                                    <TripCard
                                        key={job.id}
                                        job={job}
                                        busy={busy === job.id}
                                        tracking={tracking}
                                        onRetryTracking={() => {
                                            setTracking("idle");
                                            setTrackingAttempt((count) => count + 1);
                                        }}
                                        onStatus={(status, code) => setStatus(job, status, code)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {doneJobs.length > 0 && (
                        <section className="ap-section">
                            <SectionHead title={a("d_history")} sub={earnedText ? `${a("d_earned")} : ${earnedText}` : null} />
                            <div className="ap-grid">
                                {doneJobs.slice(0, 30).map((job) => (
                                    <article key={job.id} className="ap-card is-muted">
                                        <div className="ap-card-head">
                                            <div>
                                                <h3 className="ap-card-title" style={{ fontSize: 16 }}>
                                                    {cargoEmoji(job.item_type, job.is_produce)} {job.quantity} × {cargoLabel(job.item_type, language)}
                                                </h3>
                                                <div className="ap-card-sub">{job.origin_city} → {job.destination_city} · {timeAgo(job.completed_at || job.created_at, language, a)}</div>
                                            </div>
                                            <span className="ap-chip ap-chip-green">✓ {a("load_COMPLETED")}</span>
                                        </div>
                                        <div className="ap-row">
                                            <span className="ap-money" style={{ fontSize: 20 }}>{formatMoney(job.agreed_price, job.currency)}</span>
                                            {job.driver_rating > 0 && <span className="ap-chip ap-chip-amber">{"★".repeat(job.driver_rating)}</span>}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}


            {/* =================================================
                PROFILE
            ================================================= */}

            {tab === "profile" && (
                <section className="ap-section ap-fade">
                    <SectionHead title={a("d_profileTitle")} />

                    <div className="ap-two">

                        <div className="ap-stack">

                            <div className="ap-card">
                                <div className="ap-row">
                                    <div>
                                        <h3 className="ap-card-title">{a("d_available")}</h3>
                                        <div className="ap-card-sub">{available ? a("d_availableOn") : a("d_availableOff")}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`ap-switch ${available ? "on" : ""}`}
                                        onClick={() => updateProfile({ available: !available }, available ? a("d_nowHidden") : a("d_nowAvailable"))}
                                        disabled={busy === "profile"}
                                        aria-pressed={available}
                                        aria-label={a("d_available")}
                                    />
                                </div>
                            </div>

                            <div className="ap-card">
                                <div className="ap-field">
                                    <label htmlFor="driver-city">📍 {a("d_myCity")}</label>
                                    <select
                                        id="driver-city"
                                        className="mk-select"
                                        value={user.base_city || ""}
                                        disabled={busy === "profile"}
                                        onChange={(event) => updateProfile({ baseCity: event.target.value }, a("d_cityUpdated", { city: event.target.value }))}
                                    >
                                        <option value="">{a("d_chooseCity")}</option>
                                        {cityNames(user.country || "CM").map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                    <small>{a("d_myCityHint")}</small>
                                </div>
                            </div>

                            <div className="ap-card" style={{ background: "linear-gradient(135deg, #ecfdf3, #ffffff)" }}>
                                <h3 className="ap-card-title">💬 {a("d_invite")}</h3>
                                <div className="ap-card-sub">{a("d_noLoadsText")}</div>
                                <div>
                                    <button type="button" className="ts-btn ts-btn-whatsapp" onClick={() => inviteShippersOnWhatsApp(language)}>
                                        {a("d_invite")}
                                    </button>
                                </div>
                            </div>

                        </div>

                        <AccountPanel user={user}>
                            <div className="ap-kv">
                                <div>
                                    <small>{a("accountVehicle")}</small>
                                    <strong>{user.vehicle_type || "—"}{user.plate_number ? ` · ${user.plate_number}` : ""}</strong>
                                </div>
                                <div>
                                    <small>★</small>
                                    <strong>{user.rating_count ? `${user.rating}/5 (${user.rating_count})` : a("s_newDriver")}</strong>
                                </div>
                                {earnedText && (
                                    <div>
                                        <small>{a("d_earned")}</small>
                                        <strong>{earnedText}</strong>
                                    </div>
                                )}
                            </div>
                        </AccountPanel>

                    </div>
                </section>
            )}


            {/* =================================================
                SHEETS
            ================================================= */}

            {offerFor && (
                <OfferSheet
                    shipment={offerFor.shipment}
                    bid={offerFor.bid}
                    busy={busy === "offer"}
                    onClose={() => setOfferFor(null)}
                    onSend={sendOffer}
                />
            )}

            {counterFor && (
                <CounterSheet
                    shipment={counterFor.shipment}
                    bid={counterFor.bid}
                    busy={busy === "counter"}
                    onClose={() => setCounterFor(null)}
                    onSend={sendCounter}
                />
            )}

        </AppShell>
    );
}

function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || "";
}


/* =========================================================
   LOAD CARD (open loads)
========================================================= */

function LoadCard({ load, bid, busy, onOffer, onAccept, onCounter }) {
    const { language } = useLanguage();

    const a = useAppText();

    const from = splitPlace(load.origin, load.origin_city);
    const to = splitPlace(load.destination, load.destination_city);

    const counter = bid?.status === "COUNTERED" && bid.last_offer_by === "SHIPPER" && bid.counter_price;

    const waiting = bid && !counter && bid.status !== "REJECTED";

    return (
        <article className={`ap-card ${counter ? "is-hot" : load.match?.type === "RETURN" ? "is-green" : ""}`}>

            <div className="ap-card-head">
                <div style={{ minWidth: 0 }}>
                    <h3 className="ap-card-title">
                        {cargoEmoji(load.item_type, load.is_produce)} {load.quantity} × {cargoLabel(load.item_type, language)}
                    </h3>
                    <div className="ap-card-sub">{timeAgo(load.created_at, language, a)}</div>
                </div>
                {load.match && (
                    <span className={`ap-chip ${load.match.type === "RETURN" ? "ap-chip-green" : "ap-chip-blue"}`}>
                        {load.match.type === "RETURN" ? "🔁" : "📍"} {load.match.city}
                    </span>
                )}
            </div>

            {load.match && (
                <div className={`ap-note ${load.match.type === "RETURN" ? "ap-note-green" : "ap-note-blue"}`}>
                    <span aria-hidden="true">{load.match.type === "RETURN" ? "🔁" : "📍"}</span>
                    <span>{a(load.match.type === "RETURN" ? "d_returnLoad" : "d_nearYou", { city: load.match.city })}</span>
                </div>
            )}

            <Route from={from.city} fromArea={from.area} to={to.city} toArea={to.area} />

            <div className="ap-chips">
                {load.route_km > 0 && <span className="ap-chip">🛣️ {a("km", { km: load.route_km })}</span>}
                {load.from_km > 0 && !load.match && <span className="ap-chip">📍 {a("kmAway", { km: load.from_km })}</span>}
                {load.is_produce && <span className="ap-chip ap-chip-green">🌾 {a("produceLoad")}</span>}
                {load.weight_kg > 0 && <span className="ap-chip">⚖️ ~{Math.round(load.weight_kg)} kg</span>}
                {load.perishable && <span className="ap-chip ap-chip-amber">❄️ {a("fresh")}</span>}
            </div>

            <div className="ap-row" style={{ alignItems: "flex-end" }}>
                <div>
                    <span className="ap-label">{a("d_offerLabel")}</span>
                    <div className="ap-money">{formatMoney(load.initial_offer, load.currency)}</div>
                </div>
                {waiting && (
                    <div style={{ textAlign: "right" }}>
                        <span className="ap-label">{a("d_yourPrice")}</span>
                        <div className="ap-money is-orange" style={{ fontSize: 20 }}>{formatMoney(bid.counter_price ?? bid.proposed_price, load.currency)}</div>
                    </div>
                )}
            </div>

            {load.price_hint && (
                <div className="ap-note">
                    <span aria-hidden="true">💡</span>
                    <span>
                        {a("usualPrice", {
                            low: formatMoney(load.price_hint.low, load.currency),
                            high: formatMoney(load.price_hint.high, load.currency),
                            count: load.price_hint.count,
                        })}
                    </span>
                </div>
            )}

            {counter && (
                <div className="ap-note ap-note-orange">
                    <span aria-hidden="true">💬</span>
                    <strong>{a("d_shipperOffers", { price: formatMoney(bid.counter_price, load.currency) })}</strong>
                </div>
            )}

            {waiting && (
                <div className="ap-note">
                    <span aria-hidden="true">⏳</span>
                    <span>{a("d_waitingShipper")}{bid.eta ? ` · ${bid.eta}` : ""}</span>
                </div>
            )}

            <div className="ap-actions">
                {counter ? (
                    <>
                        <button type="button" className="ts-btn ts-btn-primary" disabled={busy === bid.id} onClick={() => onAccept(bid)}>
                            ✓ {a("d_accept", { price: formatMoney(bid.counter_price, load.currency) })}
                        </button>
                        <button type="button" className="ts-btn ts-btn-light" onClick={() => onCounter(bid)}>
                            {a("d_counter")}
                        </button>
                    </>
                ) : bid ? (
                    <button type="button" className="ts-btn ts-btn-light" onClick={onOffer}>
                        ✎ {a("d_changePrice")}
                    </button>
                ) : (
                    <button type="button" className="ts-btn ts-btn-primary" onClick={onOffer}>
                        {a("d_sendPrice")} →
                    </button>
                )}
            </div>

        </article>
    );
}


/* =========================================================
   OFFER CARD (my offers tab)
========================================================= */

function OfferCard({ bid, shipment, busy, onAccept, onCounter, onChange }) {
    const { language } = useLanguage();

    const a = useAppText();

    const counter = bid.status === "COUNTERED" && bid.last_offer_by === "SHIPPER" && bid.counter_price && shipment?.status === "OPEN";

    const status = counter ? "COUNTERED" : bid.status === "COUNTERED" ? "PENDING" : bid.status;

    const tone = { PENDING: "", COUNTERED: "ap-chip-orange", ACCEPTED: "ap-chip-green", REJECTED: "ap-chip-red" }[status] || "";

    return (
        <article className={`ap-card ${counter ? "is-hot" : status === "REJECTED" ? "is-muted" : ""}`}>
            <div className="ap-card-head">
                <div style={{ minWidth: 0 }}>
                    <h3 className="ap-card-title" style={{ fontSize: 16 }}>
                        {shipment
                            ? `${cargoEmoji(shipment.item_type, shipment.is_produce)} ${shipment.origin_city} → ${shipment.destination_city}`
                            : "📦 —"}
                    </h3>
                    <div className="ap-card-sub">
                        {shipment ? `${shipment.quantity} × ${cargoLabel(shipment.item_type, language)} · ` : ""}
                        {timeAgo(bid.created_at, language, a)}
                    </div>
                </div>
                <span className={`ap-chip ${tone}`}>{a(`d_offer_${status}`)}</span>
            </div>

            <div className="ap-kv">
                <div>
                    <small>{a("d_yourPrice")}</small>
                    <strong>{formatMoney(bid.last_offer_by === "DRIVER" && bid.counter_price ? bid.counter_price : bid.proposed_price, shipment?.currency)}</strong>
                </div>
                {counter && (
                    <div>
                        <small>{a("d_offerLabel")}</small>
                        <strong style={{ color: "var(--ts-orange-deep)" }}>{formatMoney(bid.counter_price, shipment?.currency)}</strong>
                    </div>
                )}
                {bid.eta && (
                    <div>
                        <small>{a("d_etaLabel")}</small>
                        <strong>{bid.eta}</strong>
                    </div>
                )}
            </div>

            {counter ? (
                <div className="ap-actions">
                    <button type="button" className="ts-btn ts-btn-primary" disabled={busy === bid.id} onClick={onAccept}>
                        ✓ {a("d_accept", { price: formatMoney(bid.counter_price, shipment?.currency) })}
                    </button>
                    <button type="button" className="ts-btn ts-btn-light" onClick={onCounter}>
                        {a("d_counter")}
                    </button>
                </div>
            ) : status === "PENDING" && shipment?.status === "OPEN" ? (
                <div className="ap-actions">
                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={onChange}>
                        ✎ {a("d_changePrice")}
                    </button>
                </div>
            ) : null}
        </article>
    );
}


/* =========================================================
   TRIP CARD (a delivery in progress)
========================================================= */

function TripCard({ job, busy, tracking, onRetryTracking, onStatus }) {
    const { language } = useLanguage();

    const a = useAppText();

    const [code, setCode] = useState("");

    const from = splitPlace(job.origin, job.origin_city);
    const to = splitPlace(job.destination, job.destination_city);

    async function finish(event) {
        event.preventDefault();

        const done = await onStatus("COMPLETED", code);

        if (done) {
            setCode("");
        }
    }

    return (
        <article className="ap-card is-hot">

            <div className="ap-card-head">
                <div style={{ minWidth: 0 }}>
                    <span className="ap-label">{a(`load_${job.status}`)}</span>
                    <h3 className="ap-card-title" style={{ marginTop: 3 }}>
                        {cargoEmoji(job.item_type, job.is_produce)} {job.quantity} × {cargoLabel(job.item_type, language)}
                    </h3>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div className="ap-money">{formatMoney(job.agreed_price, job.currency)}</div>
                </div>
            </div>

            <DeliverySteps status={job.status} />

            <Route from={from.city} fromArea={from.area} to={to.city} toArea={to.area} />

            <div className="ap-chips">
                {job.route_km > 0 && <span className="ap-chip">🛣️ {a("km", { km: job.route_km })}</span>}
                {job.weight_kg > 0 && <span className="ap-chip">⚖️ ~{Math.round(job.weight_kg)} kg</span>}
                {job.perishable && <span className="ap-chip ap-chip-amber">❄️ {a("fresh")}</span>}
            </div>

            {/* Farm pickup (Tayeb Marché orders) */}
            {job.pickup_phone && (
                <div className="ap-note ap-note-green" style={{ display: "grid", gap: 10 }}>
                    <strong>🌾 {a("d_pickupFarm")}{job.pickup_name ? ` · ${job.pickup_name}` : ""}</strong>
                    {job.details && <span>{job.details}</span>}
                    <a className="ts-btn ts-btn-green ts-btn-sm" href={telHref(job.pickup_phone)}>
                        📞 {a("d_callFarmer")} · {formatPhone(job.pickup_phone)}
                    </a>
                </div>
            )}

            {/* Contacts */}
            {job.shipper && (
                <div className="ap-row" style={{ flexWrap: "wrap" }}>
                    <Person name={job.shipper.full_name} detail={a("d_shipper")} />
                    {job.shipper.phone_number && (
                        <a className="ts-btn ts-btn-light ts-btn-sm" href={telHref(job.shipper.phone_number)}>
                            📞 {formatPhone(job.shipper.phone_number)}
                        </a>
                    )}
                </div>
            )}

            {job.receiver_phone && (
                <a className="ts-btn ts-btn-light" href={telHref(job.receiver_phone)}>
                    📞 {a("d_callReceiver")} · {formatPhone(job.receiver_phone)}
                </a>
            )}

            {/* Live location while on the road */}
            {job.status === "DEPARTED" && (
                <div className={`ap-note ${tracking === "on" ? "ap-note-green" : "ap-note-orange"}`} style={{ display: "grid", gap: 10 }}>
                    <span>📡 {tracking === "on" ? a("d_trackingOn") : tracking === "denied" ? a("d_trackingBlocked") : a("d_trackingOff")}</span>
                    {tracking !== "on" && (
                        <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={onRetryTracking}>
                            📡 {a("d_shareLocation")}
                        </button>
                    )}
                </div>
            )}

            {/* Next step */}
            {job.status === "MATCHED" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy} onClick={() => onStatus("DEPARTED")}>
                    🚚 {a("d_start")}
                </button>
            )}

            {job.status === "DEPARTED" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy} onClick={() => onStatus("ARRIVED")}>
                    📍 {a("d_arrived")}
                </button>
            )}

            {job.status === "ARRIVED" && job.code_locked && (
                <div className="ap-note ap-note-red">
                    <span aria-hidden="true">🔒</span>
                    <span>{a("d_codeLocked")}</span>
                </div>
            )}

            {job.status === "ARRIVED" && !job.code_locked && (
                <form className="ap-form" onSubmit={finish}>
                    {job.needs_code && (
                        <div className="ap-field">
                            <label htmlFor={`code-${job.id}`}>🔑 {a("d_codeLabel")}</label>
                            <input
                                id={`code-${job.id}`}
                                className="mk-input ap-pin"
                                value={code}
                                onChange={(event) => setCode(digits(event.target.value).slice(0, 4))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="••••"
                                required
                            />
                            <small>{a("d_codeHint")}</small>
                        </div>
                    )}
                    <button
                        type="submit"
                        className="ts-btn ts-btn-green ts-btn-lg"
                        disabled={busy || (job.needs_code && code.length !== 4)}
                    >
                        ✓ {a("d_finish")}
                    </button>
                </form>
            )}

        </article>
    );
}


/* =========================================================
   SEND / CHANGE MY PRICE
========================================================= */

function OfferSheet({ shipment, bid, busy, onClose, onSend }) {
    const { language } = useLanguage();

    const a = useAppText();

    const currency = shipment.currency || "XAF";

    const [price, setPrice] = useState(bid?.proposed_price ? String(bid.proposed_price) : "");

    const [eta, setEta] = useState(bid?.eta || "");

    const [note, setNote] = useState(bid?.note || "");

    const from = splitPlace(shipment.origin, shipment.origin_city);
    const to = splitPlace(shipment.destination, shipment.destination_city);

    const quick = [
        Number(shipment.initial_offer),
        shipment.price_hint?.median,
        Math.round((Number(shipment.initial_offer) * 1.1) / 500) * 500,
    ].filter((value, index, list) => value > 0 && list.indexOf(value) === index);

    const etaChoices = language === "fr" ? ["Maintenant", "Aujourd'hui", "Demain"] : ["Now", "Today", "Tomorrow"];

    function submit(event) {
        event.preventDefault();
        onSend({ shipment, price: Number(digits(price)), eta, note });
    }

    return (
        <Sheet title={a("d_sheetTitle")} onClose={onClose} busy={busy}>
            <form className="ap-form" onSubmit={submit}>

                <div className="ap-card is-muted" style={{ padding: 16 }}>
                    <Route from={from.city} fromArea={from.area} to={to.city} toArea={to.area} />
                    <div className="ap-chips">
                        <span className="ap-chip">{shipment.quantity} × {cargoLabel(shipment.item_type, language)}</span>
                        {shipment.route_km > 0 && <span className="ap-chip">🛣️ {a("km", { km: shipment.route_km })}</span>}
                    </div>
                </div>

                <div className="ap-field">
                    <label htmlFor="offer-price">{a("d_priceLabel", { currency })}</label>
                    <input
                        id="offer-price"
                        className="mk-input ap-input-big"
                        inputMode="numeric"
                        value={price ? Number(digits(price)).toLocaleString("en-US") : ""}
                        onChange={(event) => setPrice(digits(event.target.value).slice(0, 10))}
                        placeholder={String(shipment.initial_offer || "")}
                        autoFocus
                        required
                    />
                    <small>{a("d_priceHelp", { price: formatMoney(shipment.initial_offer, currency) })}</small>
                    <div className="ap-chips">
                        {quick.map((value) => (
                            <button key={value} type="button" className="ap-chip ap-chip-orange" style={{ border: 0, cursor: "pointer" }} onClick={() => setPrice(String(value))}>
                                {formatMoney(value, currency)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ap-field">
                    <label htmlFor="offer-eta">{a("d_etaLabel")}</label>
                    <input
                        id="offer-eta"
                        className="mk-input"
                        value={eta}
                        maxLength={60}
                        onChange={(event) => setEta(event.target.value)}
                        placeholder={a("d_etaPlaceholder")}
                    />
                    <div className="ap-chips">
                        {etaChoices.map((choice) => (
                            <button key={choice} type="button" className="ap-chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setEta(choice)}>
                                {choice}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ap-field">
                    <label htmlFor="offer-note">{a("d_noteLabel")} <small>({a("optional")})</small></label>
                    <textarea
                        id="offer-note"
                        className="mk-textarea"
                        rows={2}
                        maxLength={300}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={a("d_notePlaceholder")}
                    />
                </div>

                <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy || !Number(digits(price))}>
                    {busy ? "…" : `${a("d_sendPrice")} →`}
                </button>

            </form>
        </Sheet>
    );
}


/* =========================================================
   PROPOSE ANOTHER PRICE
========================================================= */

function CounterSheet({ shipment, bid, busy, onClose, onSend }) {
    const a = useAppText();

    const currency = shipment?.currency || "XAF";

    const [price, setPrice] = useState("");

    function submit(event) {
        event.preventDefault();
        onSend({ bid, price: Number(digits(price)) });
    }

    return (
        <Sheet title={a("d_counterSheet")} onClose={onClose} busy={busy}>
            <form className="ap-form" onSubmit={submit}>

                <div className="ap-note ap-note-orange">
                    <span aria-hidden="true">💬</span>
                    <strong>{a("d_shipperOffers", { price: formatMoney(bid.counter_price, currency) })}</strong>
                </div>

                <div className="ap-field">
                    <label htmlFor="counter-price">{a("d_priceLabel", { currency })}</label>
                    <input
                        id="counter-price"
                        className="mk-input ap-input-big"
                        inputMode="numeric"
                        value={price ? Number(digits(price)).toLocaleString("en-US") : ""}
                        onChange={(event) => setPrice(digits(event.target.value).slice(0, 10))}
                        autoFocus
                        required
                    />
                </div>

                <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy || !Number(digits(price))}>
                    {busy ? "…" : a("send")}
                </button>

            </form>
        </Sheet>
    );
}
