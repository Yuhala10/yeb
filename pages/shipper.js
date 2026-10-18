import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AccountPanel from "../components/App/AccountPanel";
import AppShell from "../components/App/AppShell";
import { AppLoading, CodeDigits, DeliverySteps, digits, Empty, Person, Route, SectionHead, Sheet, splitPlace, Stars, timeAgo } from "../components/App/Bits";
import { useFeedback } from "../components/App/Feedback";
import OrderCard from "../components/Market/OrderCard";
import PhoneInput from "../components/Site/PhoneInput";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { appError, useAppText } from "../lib/appText";
import { CARGO_TYPES, cargoEmoji, cargoLabel } from "../lib/cargo";
import { cityNames, findCity } from "../lib/cities";
import { countryName, countryOrDefault, findCountry, sortedCountries } from "../lib/countries";
import { useLanguage } from "../lib/LanguageContext";
import { marketError, useMarketText } from "../lib/marketText";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref, whatsappHref } from "../lib/phone";
import { productEmoji, productName } from "../lib/produce";
import { shareLoadOnWhatsApp } from "../lib/shareLoad";
import { leaveDashboard, useRoleUser } from "../lib/useSession";

/*
 * ============================================================
 * SHIPPER AND BUYER
 * ============================================================
 *
 * Post a load, compare drivers' prices, choose one, give the
 * receiver the delivery code, follow the truck, rate. The
 * same account buys produce on Tayeb Marché: those orders
 * and product alerts live in the Orders tab. Refreshes every
 * 20 seconds while open.
 */

const LIVE = ["MATCHED", "DEPARTED", "ARRIVED"];

// Leaflet needs the browser: loaded only where a map is shown.
const TripMap = dynamic(() => import("../components/Map/TripMap"), { ssr: false });

function trackLink(shipment, language) {
    if (typeof window === "undefined" || !shipment.track_token) {
        return "";
    }

    return `${window.location.origin}${language === "en" ? "/en" : ""}/track/${shipment.id}?t=${shipment.track_token}`;
}

const EMPTY_FORM = {
    type: "Bags/Sacks",
    other: "",
    quantity: "",
    originCountry: "",
    originCity: "",
    originArea: "",
    destinationCountry: "",
    destinationCity: "",
    destinationArea: "",
    price: "",
    receiverPhone: "",
};

export default function ShipperPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const m = useMarketText();

    const { toast, confirm } = useFeedback();

    const [user, setUser] = useRoleUser("SHIPPER");

    const [data, setData] = useState(null);

    const [market, setMarket] = useState({ ready: false, orders: [], alerts: [] });

    const [tab, setTab] = useState(null);

    const [busy, setBusy] = useState(null);

    const [counterFor, setCounterFor] = useState(null);

    /* =========================================================
       DATA
    ========================================================= */

    async function load() {
        try {
            const result = await apiGet("/api/shipper");

            setData(result);
            setUser(result.user);

            // First visit: straight to what matters.
            setTab((current) => {
                if (current) {
                    return current;
                }

                if (typeof window !== "undefined" && window.location.hash === "#orders") {
                    return "orders";
                }

                return (result.shipments || []).some((item) => item.status === "OPEN" || LIVE.includes(item.status)) ? "loads" : "send";
            });
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                leaveDashboard(router, "SHIPPER");
            }
        }
    }

    async function loadMarket() {
        try {
            setMarket(await apiGet("/api/market?orders=mine"));
        } catch {
            // The market is optional: the dashboard works without it.
        }
    }

    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        return pollWhileVisible(() => {
            load();
            loadMarket();
        }, 20000);
        // load and loadMarket only set state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    /* =========================================================
       GROUPS
    ========================================================= */

    const shipments = useMemo(() => data?.shipments || [], [data]);

    const bids = useMemo(() => data?.bids || [], [data]);

    const live = shipments.filter((item) => item.status === "OPEN" || LIVE.includes(item.status));

    const history = shipments.filter((item) => item.status === "COMPLETED" || item.status === "CANCELLED");

    const bidsFor = (shipmentId) => bids.filter((bid) => bid.shipment_id === shipmentId && bid.status !== "REJECTED");

    const openIds = new Set(shipments.filter((item) => item.status === "OPEN").map((item) => item.id));

    const toAnswer = bids.filter((bid) => openIds.has(bid.shipment_id) && bid.status !== "REJECTED" && bid.last_offer_by !== "SHIPPER").length;

    const liveOrders = market.orders.filter((order) => order.status === "PENDING" || order.status === "CONFIRMED").length;

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
                leaveDashboard(router, "SHIPPER");
                return false;
            }

            toast(appError(language, error), "error");
            await load();

            return false;
        } finally {
            setBusy(null);
        }
    }

    async function post(cargo) {
        const result = await run("post", () => apiPost("/api/shipper", { action: "post", ...cargo }));

        if (result) {
            toast(result.notified > 0 ? a("s_posted", { count: result.notified }) : a("s_postedNone"), "success");
            setTab("loads");
            return true;
        }

        return false;
    }

    async function choose(bid, shipment) {
        const price = formatMoney(bid.counter_price ?? bid.proposed_price, shipment.currency);

        const yes = await confirm({
            title: a("s_chooseTitle", { name: bid.driver?.full_name || "", price }),
            text: a("s_chooseText"),
            confirmLabel: a("s_choose", { price }),
            icon: "🤝",
        });

        if (yes) {
            await run(bid.id, () => apiPost("/api/shipper", { action: "accept", bidId: bid.id }), a("s_chosen"));
        }
    }

    async function sendCounter(bid, price) {
        const done = await run("counter", () => apiPost("/api/shipper", { action: "counter", bidId: bid.id, price }), a("s_counterSent"));

        if (done) {
            setCounterFor(null);
        }
    }

    async function setStatus(shipment, status) {
        const ask = {
            CANCELLED: [a("s_cancelTitle"), a("s_cancelText"), a("s_cancel"), "danger", "✕", a("s_cancelled")],
            DEPARTED: [a("s_handedTitle"), a("s_handedText"), a("s_handedOver"), null, "📦", null],
            COMPLETED: [a("s_receivedTitle"), a("s_receivedText"), a("s_received"), null, "✅", a("s_completed")],
        }[status];

        if (!(await confirm({ title: ask[0], text: ask[1], confirmLabel: ask[2], tone: ask[3], icon: ask[4] }))) {
            return;
        }

        await run(shipment.id, () => apiPost("/api/shipper", { action: "status", shipmentId: shipment.id, status }), ask[5]);
    }

    async function rate(shipment, rating) {
        await run(shipment.id, () => apiPost("/api/shipper", { action: "rate", shipmentId: shipment.id, rating }), a("s_thanksRating"));
    }

    async function orderAction(action, order, extra = {}) {
        const question = action === "cancel" ? m("cancelQuestion") : action === "received" ? m("receivedQuestion") : null;

        if (question && !(await confirm({ title: question, tone: action === "cancel" ? "danger" : null, icon: action === "cancel" ? "✕" : "✅" }))) {
            return;
        }

        setBusy(order.id);

        try {
            await apiPost("/api/market", { action, orderId: order.id, ...extra });

            if (action === "rate") {
                toast(m("thanksRating"), "success");
            }
        } catch (error) {
            toast(marketError(language, error), "error");
        } finally {
            setBusy(null);
            await Promise.all([load(), loadMarket()]);
        }
    }

    async function removeAlert(alert) {
        setBusy(alert.id);

        try {
            await apiPost("/api/market", { action: "deleteAlert", alertId: alert.id });
            toast(a("s_alertRemoved"), "success");
            await loadMarket();
        } catch (error) {
            toast(marketError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    /* =========================================================
       SCREEN
    ========================================================= */

    if (!user || !data || !tab) {
        return <AppLoading />;
    }

    const tabs = [
        { key: "send", label: a("s_tabSend"), icon: "➕" },
        { key: "loads", label: a("s_tabLoads"), icon: "🚚", count: toAnswer },
        ...(market.ready ? [{ key: "orders", label: a("s_tabOrders"), icon: "🧺", count: liveOrders }] : []),
        { key: "profile", label: a("s_tabProfile"), icon: "👤" },
    ];

    return (
        <AppShell
            user={user}
            eyebrow={`${a("role_SHIPPER")}${user.country ? ` · ${findCountry(user.country)?.flag || ""} ${countryName(user.country, language)}` : ""}`}
            title={<>{a("helloWord")}, <em>{String(user.full_name || "").split(/\s+/)[0]}</em></>}
            subtitle={a("s_sub")}
            actions={
                <>
                    <button type="button" className="ts-btn ts-btn-primary" onClick={() => setTab("send")}>
                        ➕ {a("s_newLoad")}
                    </button>
                    {market.ready && (
                        <Link href="/market" className="ts-btn ts-btn-glass">
                            🌾 {a("menuMarket")}
                        </Link>
                    )}
                </>
            }
            stats={[
                { value: live.length, label: a("s_statLive") },
                { value: toAnswer, label: a("s_statPrices"), hot: toAnswer > 0 },
                { value: shipments.filter((item) => item.status === "COMPLETED").length, label: a("s_statDone") },
                ...(market.ready ? [{ value: market.orders.length, label: a("s_statOrders") }] : []),
            ]}
            tabs={tabs}
            tab={tab}
            onTab={setTab}
        >

            {/* =================================================
                SEND
            ================================================= */}

            {tab === "send" && (
                <section className="ap-section ap-fade">
                    <div className="ap-two">
                        <PostForm user={user} busy={busy === "post"} onPost={post} />

                        <div className="ap-stack">
                            <div className="ap-card" style={{ background: "var(--ts-ink)", color: "rgba(255,255,255,0.78)", borderColor: "transparent" }}>
                                <span className="ap-label" style={{ color: "#fdba74" }}>Tayeb</span>
                                {[
                                    ["1", language === "fr" ? "Publiez en une minute, gratuitement." : "Post in a minute, for free."],
                                    ["2", language === "fr" ? "Les chauffeurs proches envoient leurs prix." : "Drivers nearby send their prices."],
                                    ["3", language === "fr" ? "Choisissez : vous recevez son numéro et un code de livraison." : "Choose one: you get their number and a delivery code."],
                                    ["4", language === "fr" ? "Suivez le camion jusqu'à la porte." : "Follow the truck to the door."],
                                ].map(([step, text]) => (
                                    <div key={step} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                        <span className="ap-count" style={{ flex: "none" }}>{step}</span>
                                        <span style={{ color: "white", fontWeight: 700 }}>{text}</span>
                                    </div>
                                ))}
                            </div>

                            {market.ready && (
                                <Link href="/market" className="ap-card" style={{ textDecoration: "none", background: "linear-gradient(135deg, #fff7ed, #ffffff)" }}>
                                    <h3 className="ap-card-title">🌾 {a("s_marketTitle")}</h3>
                                    <div className="ap-card-sub">{a("s_marketText")}</div>
                                    <span className="ts-link">{a("s_goMarket")} →</span>
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
            )}


            {/* =================================================
                MY LOADS
            ================================================= */}

            {tab === "loads" && (
                <>
                    <section className="ap-section ap-fade">
                        <SectionHead title={a("s_loadsTitle")} count={toAnswer}>
                            <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={() => setTab("send")}>
                                ➕ {a("s_newLoad")}
                            </button>
                        </SectionHead>

                        {live.length === 0 ? (
                            <Empty icon="📦" title={a("s_noLoads")} text={a("s_noLoadsText")}>
                                <button type="button" className="ts-btn ts-btn-primary" onClick={() => setTab("send")}>
                                    ➕ {a("s_newLoad")}
                                </button>
                            </Empty>
                        ) : (
                            <div className="ap-stack">
                                {live.map((shipment) => (
                                    <LoadCard
                                        key={shipment.id}
                                        shipment={shipment}
                                        bids={bidsFor(shipment.id)}
                                        busy={busy}
                                        onChoose={(bid) => choose(bid, shipment)}
                                        onCounter={(bid) => setCounterFor({ bid, shipment })}
                                        onStatus={(status) => setStatus(shipment, status)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {history.length > 0 && (
                        <section className="ap-section">
                            <SectionHead title={a("s_history")} />
                            <div className="ap-grid">
                                {history.slice(0, 40).map((shipment) => (
                                    <article key={shipment.id} className="ap-card is-muted">
                                        <div className="ap-card-head">
                                            <div style={{ minWidth: 0 }}>
                                                <h3 className="ap-card-title" style={{ fontSize: 16 }}>
                                                    {cargoEmoji(shipment.item_type, shipment.is_produce)} {shipment.origin_city} → {shipment.destination_city}
                                                </h3>
                                                <div className="ap-card-sub">
                                                    {shipment.quantity} × {cargoLabel(shipment.item_type, language)} · {timeAgo(shipment.completed_at || shipment.created_at, language, a)}
                                                </div>
                                            </div>
                                            <span className={`ap-chip ${shipment.status === "COMPLETED" ? "ap-chip-green" : "ap-chip-red"}`}>
                                                {a(`load_${shipment.status}`)}
                                            </span>
                                        </div>

                                        {shipment.status === "COMPLETED" && (
                                            <>
                                                <div className="ap-row">
                                                    <span className="ap-money" style={{ fontSize: 20 }}>{formatMoney(shipment.agreed_price, shipment.currency)}</span>
                                                    {shipment.driver && <span className="ap-card-sub">🚚 {shipment.driver.full_name}</span>}
                                                </div>
                                                {shipment.driver_rating ? (
                                                    <span className="ap-chip ap-chip-amber">{"★".repeat(shipment.driver_rating)} · {a("s_rated")}</span>
                                                ) : shipment.driver ? (
                                                    <div className="ap-field">
                                                        <span className="ap-field-label">{a("s_rateTitle", { name: shipment.driver.full_name })}</span>
                                                        <Stars disabled={busy === shipment.id} onRate={(stars) => rate(shipment, stars)} />
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}


            {/* =================================================
                PRODUCE ORDERS
            ================================================= */}

            {tab === "orders" && (
                <>
                    <section className="ap-section ap-fade" id="orders">
                        <SectionHead title={a("s_ordersTitle")} count={liveOrders}>
                            <Link href="/market" className="ts-btn ts-btn-light ts-btn-sm">🌾 {a("s_goMarket")}</Link>
                        </SectionHead>

                        {market.orders.length === 0 ? (
                            <Empty icon="🧺" title={a("s_noOrders")} text={a("s_noOrdersText")}>
                                <Link href="/market" className="ts-btn ts-btn-primary">🌾 {a("s_goMarket")}</Link>
                            </Empty>
                        ) : (
                            <div className="ap-stack">
                                {market.orders.slice(0, 40).map((order) => (
                                    <OrderCard key={order.id} order={order} role="buyer" busy={busy === order.id} onAction={orderAction} />
                                ))}
                            </div>
                        )}
                    </section>

                    {market.alerts?.length > 0 && (
                        <section className="ap-section">
                            <SectionHead title={`🔔 ${a("s_alertsTitle")}`} sub={a("s_alertsText")} />
                            <div className="ap-grid">
                                {market.alerts.map((alert) => (
                                    <div key={alert.id} className="ap-card" style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}>
                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ color: "var(--ts-ink)" }}>
                                                {productEmoji(alert.product)} {productName({ product: alert.product }, language)}
                                            </strong>
                                            <div className="ap-card-sub">
                                                {findCountry(alert.country)?.flag} {alert.city || countryName(alert.country, language)}
                                            </div>
                                        </div>
                                        <button type="button" className="ts-btn ts-btn-light ts-btn-sm" disabled={busy === alert.id} onClick={() => removeAlert(alert)}>
                                            {a("s_alertRemove")}
                                        </button>
                                    </div>
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
                    <SectionHead title={a("s_tabProfile")} />
                    <div style={{ maxWidth: 720 }}>
                        <AccountPanel user={user} />
                    </div>
                </section>
            )}

            {counterFor && (
                <CounterSheet
                    bid={counterFor.bid}
                    shipment={counterFor.shipment}
                    busy={busy === "counter"}
                    onClose={() => setCounterFor(null)}
                    onSend={(price) => sendCounter(counterFor.bid, price)}
                />
            )}

        </AppShell>
    );
}


/* =========================================================
   POST A LOAD
========================================================= */

function PostForm({ user, busy, onPost }) {
    const { language } = useLanguage();

    const a = useAppText();

    const { toast } = useFeedback();

    const home = countryOrDefault(user.country).code;

    const [form, setForm] = useState({ ...EMPTY_FORM, originCountry: home, destinationCountry: home });

    const [route, setRoute] = useState(null);

    const origin = countryOrDefault(form.originCountry);

    const other = form.type === "OTHER";

    async function loadRoute(from, to) {
        if (!from || !to) {
            setRoute(null);
            return;
        }

        try {
            setRoute(await apiGet(`/api/shipper?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
        } catch {
            setRoute(null);
        }
    }

    function update(changes) {
        const next = { ...form, ...changes };

        if (changes.originCountry && changes.originCountry !== form.originCountry) {
            next.originCity = "";
        }

        if (changes.destinationCountry && changes.destinationCountry !== form.destinationCountry) {
            next.destinationCity = "";
        }

        setForm(next);

        if (next.originCity !== form.originCity || next.destinationCity !== form.destinationCity) {
            loadRoute(next.originCity, next.destinationCity);
        }
    }

    async function submit(event) {
        event.preventDefault();

        const itemType = other ? form.other.trim() : form.type;

        const quantity = Number(form.quantity);

        const price = Number(digits(form.price));

        if (!itemType || !form.originCity || !form.destinationCity || !(quantity > 0) || !(price > 0)) {
            toast(a("s_missing"), "error");
            return;
        }

        const done = await onPost({
            itemType,
            quantity,
            price,
            originCountry: form.originCountry,
            originCity: form.originCity,
            originArea: form.originArea,
            destinationCountry: form.destinationCountry,
            destinationCity: form.destinationCity,
            destinationArea: form.destinationArea,
            receiverPhone: form.receiverPhone.trim(),
        });

        if (done) {
            setForm({ ...EMPTY_FORM, originCountry: home, destinationCountry: home });
            setRoute(null);
        }
    }

    const countries = sortedCountries(language);

    return (
        <form className="ap-card ap-form" onSubmit={submit}>

            <div>
                <span className="ap-label">{a("s_newLoad")}</span>
                <h2 className="ap-card-title" style={{ fontSize: 24, marginTop: 4 }}>{a("s_formTitle")}</h2>
                <div className="ap-card-sub">{a("s_formSub")}</div>
            </div>

            {/* What */}
            <div className="ap-field">
                <span className="ap-field-label">{a("s_type")}</span>
                <div className="ap-choices">
                    {CARGO_TYPES.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            className={`ap-choice ${form.type === item.value ? "active" : ""}`}
                            onClick={() => update({ type: item.value })}
                            aria-pressed={form.type === item.value}
                        >
                            <span aria-hidden="true">{item.emoji}</span>
                            <span>{language === "fr" ? item.fr : item.en}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`ap-choice ${other ? "active" : ""}`}
                        onClick={() => update({ type: "OTHER" })}
                        aria-pressed={other}
                    >
                        <span aria-hidden="true">✏️</span>
                        <span>{language === "fr" ? "Autre" : "Other"}</span>
                    </button>
                </div>
                {other && (
                    <input
                        className="mk-input"
                        value={form.other}
                        maxLength={60}
                        onChange={(event) => update({ other: event.target.value })}
                        placeholder={a("s_typeOtherPlaceholder")}
                        aria-label={a("s_typeOther")}
                        autoFocus
                    />
                )}
            </div>

            <div className="ap-field">
                <label htmlFor="cargo-quantity">{a("s_quantity")}</label>
                <input
                    id="cargo-quantity"
                    className="mk-input"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(event) => update({ quantity: event.target.value })}
                    placeholder={a("s_quantityPlaceholder")}
                />
            </div>

            {/* Where */}
            <div className="ap-form-grid">
                {[
                    ["origin", a("from"), "🟠"],
                    ["destination", a("to"), "🟢"],
                ].map(([side, label, dot]) => (
                    <fieldset key={side} className="ap-card is-muted" style={{ padding: 14, margin: 0, gap: 10 }}>
                        <legend className="ap-field-label" style={{ padding: 0 }}>{dot} {label}</legend>
                        <select
                            className="mk-select"
                            value={form[`${side}Country`]}
                            onChange={(event) => update({ [`${side}Country`]: event.target.value })}
                            aria-label={`${label} · ${a("s_country")}`}
                        >
                            {countries.map((item) => (
                                <option key={item.code} value={item.code}>
                                    {item.flag} {language === "fr" ? item.fr : item.en}
                                </option>
                            ))}
                        </select>
                        <select
                            className="mk-select"
                            value={form[`${side}City`]}
                            onChange={(event) => update({ [`${side}City`]: event.target.value })}
                            aria-label={`${label} · ${a("s_city")}`}
                            required
                        >
                            <option value="">{a("s_chooseCity")}</option>
                            {cityNames(form[`${side}Country`]).map((city) => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        <input
                            className="mk-input"
                            value={form[`${side}Area`]}
                            maxLength={80}
                            onChange={(event) => update({ [`${side}Area`]: event.target.value })}
                            placeholder={`${a("s_area")} (${a("optional")})`}
                            aria-label={`${label} · ${a("s_area")}`}
                        />
                    </fieldset>
                ))}
            </div>

            {route && (route.route_km > 0 || route.hint) && (
                <div className="ap-note ap-note-blue">
                    <span aria-hidden="true">🛣️</span>
                    <span>
                        {route.route_km > 0 && <strong>{a("s_route", { km: route.route_km })}</strong>}
                        {route.hint && (
                            <>
                                {route.route_km > 0 ? " · " : ""}
                                {a("usualPrice", {
                                    low: formatMoney(route.hint.low, origin.currency),
                                    high: formatMoney(route.hint.high, origin.currency),
                                    count: route.hint.count,
                                })}
                            </>
                        )}
                    </span>
                </div>
            )}

            {/* Price */}
            <div className="ap-field">
                <label htmlFor="cargo-price">{a("s_price", { currency: origin.currency })}</label>
                <input
                    id="cargo-price"
                    className="mk-input ap-input-big"
                    inputMode="numeric"
                    value={form.price ? Number(digits(form.price)).toLocaleString("en-US") : ""}
                    onChange={(event) => update({ price: digits(event.target.value).slice(0, 10) })}
                    placeholder={route?.hint ? String(route.hint.median) : "25,000"}
                />
                <small>{a("s_priceHelp")}</small>
            </div>

            {/* Receiver */}
            <div className="ap-field">
                <label htmlFor="cargo-receiver">{a("s_receiver")} <small>({a("optional")})</small></label>
                <PhoneInput
                    id="cargo-receiver"
                    country={form.destinationCountry}
                    onCountry={(code) => update({ destinationCountry: code })}
                    value={form.receiverPhone}
                    onChange={(value) => update({ receiverPhone: value })}
                    required={false}
                />
                <small>{a("s_receiverHelp")}</small>
            </div>

            <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy}>
                {busy ? "…" : `${a("s_post")} →`}
            </button>

        </form>
    );
}


/* =========================================================
   ONE LOAD
========================================================= */

function LoadCard({ shipment, bids, busy, onChoose, onCounter, onStatus }) {
    const { language } = useLanguage();

    const a = useAppText();

    const from = splitPlace(shipment.origin, shipment.origin_city);
    const to = splitPlace(shipment.destination, shipment.destination_city);

    const isOpen = shipment.status === "OPEN";

    const driver = shipment.driver;

    const toAnswer = bids.some((bid) => bid.last_offer_by !== "SHIPPER");

    return (
        <article className={`ap-card ${isOpen && toAnswer ? "is-hot" : !isOpen ? "is-green" : ""}`}>

            <div className="ap-card-head">
                <div style={{ minWidth: 0 }}>
                    <h3 className="ap-card-title">
                        {cargoEmoji(shipment.item_type, shipment.is_produce)} {shipment.quantity} × {cargoLabel(shipment.item_type, language)}
                    </h3>
                    <div className="ap-card-sub">{timeAgo(shipment.created_at, language, a)}</div>
                </div>
                <span className={`ap-chip ${isOpen ? "ap-chip-orange" : "ap-chip-green"}`}>{a(`load_${shipment.status}`)}</span>
            </div>

            {!isOpen && <DeliverySteps status={shipment.status} />}

            <Route from={from.city} fromArea={from.area} to={to.city} toArea={to.area} />

            <div className="ap-chips">
                {shipment.is_produce && <span className="ap-chip ap-chip-green">🌾 {a("produceLoad")}</span>}
                {shipment.route_km > 0 && <span className="ap-chip">🛣️ {a("km", { km: shipment.route_km })}</span>}
                {shipment.receiver_phone && <span className="ap-chip">📞 {formatPhone(shipment.receiver_phone)}</span>}
                <span className="ap-chip ap-chip-ink">{formatMoney(shipment.agreed_price ?? shipment.initial_offer, shipment.currency)}</span>
            </div>

            {/* ---------- waiting for a driver ---------- */}

            {isOpen && (
                <>
                    {shipment.price_hint && (
                        <div className="ap-note">
                            <span aria-hidden="true">💡</span>
                            <span>
                                {a("usualPrice", {
                                    low: formatMoney(shipment.price_hint.low, shipment.currency),
                                    high: formatMoney(shipment.price_hint.high, shipment.currency),
                                    count: shipment.price_hint.count,
                                })}
                            </span>
                        </div>
                    )}

                    <div className="ap-row">
                        <span className="ap-field-label">{a("s_prices")}</span>
                        {bids.length > 0 && <span className="ap-count">{bids.length}</span>}
                    </div>

                    {bids.length === 0 ? (
                        <div className="ap-note ap-note-orange">
                            <span className="ts-pulse" aria-hidden="true" style={{ background: "var(--ts-orange)", marginTop: 6 }} />
                            <span>{a("s_noBids")}</span>
                        </div>
                    ) : (
                        <div className="ap-stack" style={{ gap: 10 }}>
                            {[...bids]
                                .sort((x, y) => Number(x.counter_price ?? x.proposed_price) - Number(y.counter_price ?? y.proposed_price))
                                .map((bid) => (
                                    <BidRow
                                        key={bid.id}
                                        bid={bid}
                                        currency={shipment.currency}
                                        busy={busy === bid.id}
                                        onChoose={() => onChoose(bid)}
                                        onCounter={() => onCounter(bid)}
                                    />
                                ))}
                        </div>
                    )}

                    <div className="ap-actions">
                        <button type="button" className="ts-btn ts-btn-whatsapp" onClick={() => shareLoadOnWhatsApp(shipment, language)}>
                            💬 {a("s_share")}
                        </button>
                        <button type="button" className="ts-btn ts-btn-light" disabled={busy === shipment.id} onClick={() => onStatus("CANCELLED")}>
                            ✕ {a("s_cancel")}
                        </button>
                    </div>
                </>
            )}

            {/* ---------- driver chosen ---------- */}

            {driver && (
                <div className="ap-row" style={{ flexWrap: "wrap" }}>
                    <Person
                        name={driver.full_name}
                        detail={[
                            driver.rating_count ? `★ ${driver.rating} (${driver.rating_count})` : a("s_newDriver"),
                            driver.vehicle_type,
                            driver.plate_number,
                        ].filter(Boolean).join(" · ")}
                    />
                    {(driver.phone_number || shipment.driver_phone) && (
                        <a className="ts-btn ts-btn-light ts-btn-sm" href={telHref(driver.phone_number || shipment.driver_phone)}>
                            📞 {formatPhone(driver.phone_number || shipment.driver_phone)}
                        </a>
                    )}
                </div>
            )}

            {shipment.delivery_code && LIVE.includes(shipment.status) && (
                <div className="ap-code">
                    <strong style={{ color: "white" }}>🔑 {a("s_codeTitle")}</strong>
                    <CodeDigits code={shipment.delivery_code} />
                    <span>{a("s_codeText")}</span>
                    <a
                        className="ts-btn ts-btn-whatsapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`${shipment.receiver_phone ? whatsappHref(shipment.receiver_phone) : "https://wa.me/"}?text=${encodeURIComponent(
                            [
                                a("s_codeMessage", { item: `${shipment.quantity} × ${cargoLabel(shipment.item_type, language)}`, code: shipment.delivery_code }),
                                trackLink(shipment, language) ? a("tk_followLink", { link: trackLink(shipment, language) }) : "",
                            ].filter(Boolean).join("\n\n")
                        )}`}
                    >
                        💬 {shipment.receiver_phone ? a("s_sendCode") : a("s_shareCode")}
                    </a>
                </div>
            )}

            {LIVE.includes(shipment.status) && <LiveCard shipment={shipment} />}

            {shipment.status === "MATCHED" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={busy === shipment.id} onClick={() => onStatus("DEPARTED")}>
                    📦 {a("s_handedOver")}
                </button>
            )}

            {(shipment.status === "DEPARTED" || shipment.status === "ARRIVED") && (
                <button type="button" className="ts-btn ts-btn-green ts-btn-lg" disabled={busy === shipment.id} onClick={() => onStatus("COMPLETED")}>
                    ✓ {a("s_received")}
                </button>
            )}

        </article>
    );
}


/* =========================================================
   ONE DRIVER'S PRICE
========================================================= */

function BidRow({ bid, currency, busy, onChoose, onCounter }) {
    const a = useAppText();

    const driver = bid.driver || {};

    const price = bid.counter_price ?? bid.proposed_price;

    const waiting = bid.last_offer_by === "SHIPPER";

    return (
        <div className={`ap-card ${waiting ? "is-muted" : ""}`} style={{ padding: 14, borderRadius: 18, boxShadow: "none" }}>
            <Person
                name={driver.full_name}
                detail={[
                    driver.rating_count ? `★ ${driver.rating} (${driver.rating_count})` : a("s_newDriver"),
                    driver.vehicle_type,
                    driver.total_completed_shipments ? a("s_trips", { count: driver.total_completed_shipments }) : null,
                ].filter(Boolean).join(" · ")}
            />

            <div className="ap-row" style={{ alignItems: "center" }}>
                <div className="ap-money is-orange" style={{ fontSize: 24 }}>{formatMoney(price, currency)}</div>
                {bid.eta && <span className="ap-chip">⏱ {a("s_driverEta")} : {bid.eta}</span>}
            </div>

            {bid.note && (
                <div className="ap-note">
                    <span aria-hidden="true">💬</span>
                    <span>{bid.note}</span>
                </div>
            )}

            {waiting ? (
                <div className="ap-note">
                    <span aria-hidden="true">⏳</span>
                    <span>{a("s_waitingDriver", { price: formatMoney(bid.counter_price, currency) })}</span>
                </div>
            ) : (
                <div className="ap-actions">
                    <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" disabled={busy} onClick={onChoose}>
                        ✓ {a("s_choose", { price: formatMoney(price, currency) })}
                    </button>
                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={onCounter}>
                        {a("s_counter")}
                    </button>
                </div>
            )}
        </div>
    );
}


/* =========================================================
   LIVE MAP CARD
========================================================= */

function LiveCard({ shipment }) {
    const a = useAppText();

    const { language } = useLanguage();

    const from = findCity(shipment.origin_city);
    const to = findCity(shipment.destination_city);

    const tracking = shipment.tracking;

    const toPickup = shipment.status === "MATCHED";

    const target = toPickup ? from : to;

    return (
        <div className="ap-map">
            <TripMap
                compact
                from={from ? { name: from.name, lat: from.lat, lng: from.lng } : null}
                to={to ? { name: to.name, lat: to.lat, lng: to.lng } : null}
                truck={tracking ? { lat: tracking.lat, lng: tracking.lng } : null}
                heading={tracking?.heading ?? null}
                phase={toPickup ? "TO_PICKUP" : shipment.status === "ARRIVED" ? "ARRIVED" : "TO_DESTINATION"}
                padding={{ top: 30, right: 30, bottom: 30, left: 30 }}
                label={a("s_truck")}
            />
            <div className="ap-map-foot">
                <span>
                    {tracking ? (
                        <>
                            <strong style={{ color: "var(--ts-ink)" }}>🚚 {tracking.minutes_ago > 0 ? a("s_updated", { n: tracking.minutes_ago }) : a("tk_live")}</strong>
                            {target && tracking.km_left !== null && !toPickup && ` · ${a("s_kmLeft", { km: tracking.km_left, city: target.name })}`}
                            {tracking.speed_kmh > 3 && ` · ${tracking.speed_kmh} km/h`}
                        </>
                    ) : (
                        a("s_waitingLocation")
                    )}
                </span>
                <Link className="ts-btn ts-btn-ink ts-btn-sm" href={`/track/${shipment.id}`} locale={language}>
                    🛰️ {a("tk_openMap")} →
                </Link>
            </div>
        </div>
    );
}


/* =========================================================
   PROPOSE A PRICE TO A DRIVER
========================================================= */

function CounterSheet({ bid, shipment, busy, onClose, onSend }) {
    const a = useAppText();

    const [price, setPrice] = useState("");

    const currency = shipment.currency || "XAF";

    function submit(event) {
        event.preventDefault();
        onSend(Number(digits(price)));
    }

    return (
        <Sheet title={a("s_counterSheet", { name: bid.driver?.full_name || "" })} onClose={onClose} busy={busy}>
            <form className="ap-form" onSubmit={submit}>
                <div className="ap-note ap-note-orange">
                    <span aria-hidden="true">🚚</span>
                    <span>
                        {bid.driver?.full_name} · <strong>{formatMoney(bid.counter_price ?? bid.proposed_price, currency)}</strong>
                    </span>
                </div>
                <div className="ap-field">
                    <label htmlFor="shipper-counter">{a("d_priceLabel", { currency })}</label>
                    <input
                        id="shipper-counter"
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

