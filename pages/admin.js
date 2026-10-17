import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AppShell from "../components/App/AppShell";
import { AppLoading, Empty, SectionHead, timeAgo } from "../components/App/Bits";
import { apiGet, pollWhileVisible } from "../lib/api";
import { useAppText } from "../lib/appText";
import { cargoLabel } from "../lib/cargo";
import { countryName, findCountry } from "../lib/countries";
import { useLanguage } from "../lib/LanguageContext";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref } from "../lib/phone";
import { formatAmount, orderReference, productEmoji, productName, unitName } from "../lib/produce";
import { leaveDashboard, useRoleUser } from "../lib/useSession";

/*
 * ============================================================
 * TAYEB CONSOLE (staff only)
 * ============================================================
 *
 * Reached from the unlisted staff entrance. Read-only view
 * of the whole platform: growth, conversion from load to
 * delivery, the market, and every record, searchable.
 * Refreshes every minute while open.
 */

const T = {
    en: {
        title: "Tayeb console",
        sub: "Everything happening on the platform, live.",
        overview: "Overview",
        overviewShort: "Overview",
        users: "People",
        loads: "Loads",
        market: "Market",
        activity: "Activity",
        refresh: "Refresh",
        updated: "Updated {when}",
        people: "people",
        drivers: "drivers",
        availableDrivers: "{count} available",
        openLoads: "open loads",
        onRoad: "on the road",
        delivered: "delivered",
        sales: "market sales",
        funnel: "From load to delivery",
        funnelSub: "How many loads reach each step.",
        posted: "Posted",
        gotPrices: "Got prices",
        matched: "Driver chosen",
        completed: "Delivered",
        roles: "People by role",
        countries: "People by country",
        last14: "Last 14 days",
        last14Sub: "New people and new loads each day.",
        newPeople: "New people",
        newLoads: "New loads",
        recentPeople: "Newest people",
        recentLoads: "Newest loads",
        search: "Search a name, number, city…",
        all: "All",
        name: "Name",
        role: "Role",
        phone: "Phone",
        country: "Country",
        city: "City",
        vehicle: "Vehicle",
        rating: "Rating",
        trips: "Trips",
        joined: "Joined",
        seen: "Last seen",
        route: "Route",
        cargo: "Cargo",
        price: "Price",
        status: "Status",
        shipper: "Shipper",
        driver: "Driver",
        offers: "Prices",
        posted_at: "Posted",
        products: "Products",
        orders: "Orders",
        product: "Product",
        farmer: "Farmer",
        stock: "Stock",
        photos: "Photos",
        total: "Total",
        buyer: "Buyer",
        delivery: "Delivery",
        bids: "Driver prices",
        notifications: "Notifications sent",
        nothing: "Nothing here yet.",
        noMatch: "Nothing matches this search.",
        pickup: "Pickup",
        available: "Available",
    },
    fr: {
        title: "Console Tayeb",
        sub: "Tout ce qui se passe sur la plateforme, en direct.",
        overview: "Vue d'ensemble",
        overviewShort: "Aperçu",
        users: "Personnes",
        loads: "Chargements",
        market: "Marché",
        activity: "Activité",
        refresh: "Actualiser",
        updated: "Mis à jour {when}",
        people: "personnes",
        drivers: "chauffeurs",
        availableDrivers: "{count} disponibles",
        openLoads: "chargements ouverts",
        onRoad: "en route",
        delivered: "livrés",
        sales: "ventes du marché",
        funnel: "Du chargement à la livraison",
        funnelSub: "Combien de chargements atteignent chaque étape.",
        posted: "Publiés",
        gotPrices: "Avec des prix",
        matched: "Chauffeur choisi",
        completed: "Livrés",
        roles: "Personnes par rôle",
        countries: "Personnes par pays",
        last14: "14 derniers jours",
        last14Sub: "Nouvelles personnes et nouveaux chargements par jour.",
        newPeople: "Nouvelles personnes",
        newLoads: "Nouveaux chargements",
        recentPeople: "Derniers inscrits",
        recentLoads: "Derniers chargements",
        search: "Chercher un nom, un numéro, une ville…",
        all: "Tous",
        name: "Nom",
        role: "Rôle",
        phone: "Téléphone",
        country: "Pays",
        city: "Ville",
        vehicle: "Véhicule",
        rating: "Note",
        trips: "Trajets",
        joined: "Inscrit",
        seen: "Vu",
        route: "Trajet",
        cargo: "Marchandise",
        price: "Prix",
        status: "Statut",
        shipper: "Expéditeur",
        driver: "Chauffeur",
        offers: "Prix",
        posted_at: "Publié",
        products: "Produits",
        orders: "Commandes",
        product: "Produit",
        farmer: "Producteur",
        stock: "Stock",
        photos: "Photos",
        total: "Total",
        buyer: "Acheteur",
        delivery: "Livraison",
        bids: "Prix des chauffeurs",
        notifications: "Notifications envoyées",
        nothing: "Rien pour l'instant.",
        noMatch: "Aucun résultat pour cette recherche.",
        pickup: "Retrait",
        available: "Disponible",
    },
};

const ROLE_ICONS = { SHIPPER: "📦", DRIVER: "🚚", FARMER: "🌾" };

const LOAD_TONES = { OPEN: "ap-chip-orange", MATCHED: "ap-chip-blue", DEPARTED: "ap-chip-blue", ARRIVED: "ap-chip-blue", COMPLETED: "ap-chip-green", CANCELLED: "ap-chip-red" };

const ORDER_TONES = { PENDING: "ap-chip-orange", CONFIRMED: "ap-chip-blue", COMPLETED: "ap-chip-green", DECLINED: "ap-chip-red", CANCELLED: "ap-chip-red", EXPIRED: "" };

function matches(query, ...values) {
    const q = query.trim().toLowerCase();

    return !q || values.some((value) => String(value ?? "").toLowerCase().includes(q));
}

function dayKey(value) {
    return String(value || "").slice(0, 10);
}

export default function AdminPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const t = (key, vars) => {
        let text = T[language === "en" ? "en" : "fr"][key] ?? key;

        for (const [name, value] of Object.entries(vars || {})) {
            text = text.replace(`{${name}}`, value);
        }

        return text;
    };

    const [user] = useRoleUser("ADMIN");

    const [data, setData] = useState(null);

    const [updatedAt, setUpdatedAt] = useState(null);

    const [tab, setTab] = useState("overview");

    const [query, setQuery] = useState("");

    const [filter, setFilter] = useState("ALL");

    async function load() {
        try {
            setData(await apiGet("/api/admin/dashboard"));
            setUpdatedAt(new Date().toISOString());
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                leaveDashboard(router, "ADMIN");
            }
        }
    }

    const isAdmin = user?.role === "ADMIN";

    useEffect(() => {
        if (!isAdmin) {
            return;
        }

        return pollWhileVisible(load, 60000);
        // load only sets state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    function pick(next) {
        setTab(next);
        setQuery("");
        setFilter("ALL");
    }

    /* =========================================================
       NUMBERS
    ========================================================= */

    const users = useMemo(() => data?.users || [], [data]);
    const shipments = useMemo(() => data?.shipments || [], [data]);
    const bids = useMemo(() => data?.bids || [], [data]);
    const products = useMemo(() => data?.products || [], [data]);
    const orders = useMemo(() => data?.orders || [], [data]);
    const notifications = useMemo(() => data?.notifications || [], [data]);

    const byId = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);

    const bidCount = useMemo(() => {
        const counts = new Map();
        bids.forEach((bid) => counts.set(bid.shipment_id, (counts.get(bid.shipment_id) || 0) + 1));
        return counts;
    }, [bids]);

    const stats = useMemo(() => {
        const count = (list, test) => list.filter(test).length;

        const salesByCurrency = orders
            .filter((order) => order.status === "COMPLETED")
            .reduce((sums, order) => {
                const code = order.currency || "XAF";
                sums[code] = (sums[code] || 0) + Number(order.total_price || 0);
                return sums;
            }, {});

        // Counted back from the last refresh (not "now"): a render
        // must give the same result every time.
        const base = updatedAt ? Date.parse(updatedAt) : 0;

        const days = [...Array(14)].map((_, index) => new Date(base - (13 - index) * 86400000).toISOString().slice(0, 10));

        const perDay = (list) => days.map((day) => list.filter((item) => dayKey(item.created_at) === day).length);

        const byRole = ["SHIPPER", "DRIVER", "FARMER"].map((role) => [role, count(users, (item) => item.role === role)]);

        const countries = Object.entries(
            users.reduce((map, item) => {
                const code = item.country || "CM";
                map[code] = (map[code] || 0) + 1;
                return map;
            }, {})
        ).sort((x, y) => y[1] - x[1]).slice(0, 8);

        const nonCancelled = shipments.filter((item) => item.status !== "CANCELLED" || bidCount.get(item.id));

        return {
            people: users.length,
            drivers: count(users, (item) => item.role === "DRIVER"),
            available: count(users, (item) => item.role === "DRIVER" && item.is_available),
            open: count(shipments, (item) => item.status === "OPEN"),
            road: count(shipments, (item) => ["MATCHED", "DEPARTED", "ARRIVED"].includes(item.status)),
            done: count(shipments, (item) => item.status === "COMPLETED"),
            sales: Object.entries(salesByCurrency).map(([code, total]) => formatMoney(total, code)).join(" · "),
            funnel: [
                [t("posted"), nonCancelled.length],
                [t("gotPrices"), count(nonCancelled, (item) => bidCount.get(item.id) > 0)],
                [t("matched"), count(nonCancelled, (item) => ["MATCHED", "DEPARTED", "ARRIVED", "COMPLETED"].includes(item.status))],
                [t("completed"), count(nonCancelled, (item) => item.status === "COMPLETED")],
            ],
            days,
            newPeople: perDay(users),
            newLoads: perDay(shipments),
            byRole,
            countries,
        };
        // t only reads the language.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [users, shipments, orders, bidCount, language, updatedAt]);

    /* =========================================================
       SCREEN
    ========================================================= */

    if (!user || !data) {
        return <AppLoading />;
    }

    const tabs = [
        { key: "overview", label: t("overviewShort"), icon: "📊" },
        { key: "users", label: t("users"), icon: "👥", count: 0 },
        { key: "loads", label: t("loads"), icon: "🚚", count: stats.open },
        { key: "market", label: t("market"), icon: "🌾" },
        { key: "activity", label: t("activity"), icon: "⚡" },
    ];

    const max = (list) => Math.max(1, ...list);

    return (
        <AppShell
            user={user}
            pageTitle={t("title")}
            eyebrow={`🛡️ ${a("role_ADMIN")}`}
            title={<em>{t("title")}</em>}
            subtitle={`${t("sub")} ${updatedAt ? `· ${t("updated", { when: timeAgo(updatedAt, language, a) })}` : ""}`}
            actions={
                <button type="button" className="ts-btn ts-btn-glass" onClick={load}>
                    ↻ {t("refresh")}
                </button>
            }
            stats={[
                { value: stats.people, label: t("people") },
                { value: stats.drivers, label: t("drivers"), small: t("availableDrivers", { count: stats.available }) },
                { value: stats.open, label: t("openLoads"), hot: stats.open > 0 },
                { value: stats.road, label: t("onRoad") },
                { value: stats.done, label: t("delivered") },
                ...(stats.sales ? [{ value: stats.sales, label: t("sales") }] : []),
            ]}
            tabs={tabs}
            tab={tab}
            onTab={pick}
        >

            {/* =================================================
                OVERVIEW
            ================================================= */}

            {tab === "overview" && (
                <div className="ap-fade">
                    <div className="ap-two">

                        <section className="ap-card">
                            <SectionHead title={t("funnel")} sub={t("funnelSub")} />
                            <div className="ap-bars">
                                {stats.funnel.map(([label, value], index) => (
                                    <div key={label} className="ap-bar">
                                        <span>{label}</span>
                                        <div><i style={{ width: `${(value / max(stats.funnel.map((item) => item[1]))) * 100}%`, opacity: 1 - index * 0.12 }} /></div>
                                        <b>
                                            {value}
                                            {index > 0 && stats.funnel[0][1] > 0 && (
                                                <small style={{ color: "var(--ts-muted)", marginLeft: 6 }}>
                                                    {Math.round((value / stats.funnel[0][1]) * 100)}%
                                                </small>
                                            )}
                                        </b>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="ap-card">
                            <SectionHead title={t("roles")} />
                            <div className="ap-bars">
                                {stats.byRole.map(([role, value]) => (
                                    <div key={role} className="ap-bar">
                                        <span>{ROLE_ICONS[role]} {a(`role_${role}`)}</span>
                                        <div><i style={{ width: `${(value / max(stats.byRole.map((item) => item[1]))) * 100}%` }} /></div>
                                        <b>{value}</b>
                                    </div>
                                ))}
                            </div>
                            {stats.countries.length > 0 && (
                                <>
                                    <hr className="ap-divider" />
                                    <span className="ap-label">{t("countries")}</span>
                                    <div className="ap-chips">
                                        {stats.countries.map(([code, value]) => (
                                            <span key={code} className="ap-chip">{findCountry(code)?.flag} {countryName(code, language)} · {value}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </section>

                    </div>

                    <section className="ap-card" style={{ marginTop: 20 }}>
                        <SectionHead title={t("last14")} sub={t("last14Sub")} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(14, minmax(0, 1fr))", gap: 6, alignItems: "end", height: 150 }}>
                            {stats.days.map((day, index) => (
                                <div key={day} title={`${day} · ${stats.newPeople[index]} / ${stats.newLoads[index]}`} style={{ display: "grid", gap: 3, alignItems: "end", height: "100%" }}>
                                    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
                                        <i style={{ flex: 1, height: `${(stats.newPeople[index] / max([...stats.newPeople, ...stats.newLoads])) * 100}%`, minHeight: 3, borderRadius: 4, background: "var(--ts-orange)" }} />
                                        <i style={{ flex: 1, height: `${(stats.newLoads[index] / max([...stats.newPeople, ...stats.newLoads])) * 100}%`, minHeight: 3, borderRadius: 4, background: "var(--ts-ink)" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="ap-chips">
                            <span className="ap-chip ap-chip-orange">■ {t("newPeople")}</span>
                            <span className="ap-chip ap-chip-ink">■ {t("newLoads")}</span>
                        </div>
                    </section>

                    <div className="ap-two" style={{ marginTop: 20 }}>
                        <section className="ap-card">
                            <SectionHead title={t("recentPeople")} />
                            {users.length === 0 ? <p className="ap-card-sub">{t("nothing")}</p> : users.slice(0, 6).map((item) => (
                                <div key={item.id} className="ap-row">
                                    <span><strong style={{ color: "var(--ts-ink)" }}>{ROLE_ICONS[item.role] || "👤"} {item.full_name}</strong> <span className="ap-card-sub">· {item.base_city || countryName(item.country, language)}</span></span>
                                    <span className="ap-card-sub">{timeAgo(item.created_at, language, a)}</span>
                                </div>
                            ))}
                        </section>
                        <section className="ap-card">
                            <SectionHead title={t("recentLoads")} />
                            {shipments.length === 0 ? <p className="ap-card-sub">{t("nothing")}</p> : shipments.slice(0, 6).map((item) => (
                                <div key={item.id} className="ap-row">
                                    <span><strong style={{ color: "var(--ts-ink)" }}>{item.origin_city || item.origin} → {item.destination_city || item.destination}</strong> <span className={`ap-chip ${LOAD_TONES[item.status] || ""}`}>{a(`load_${item.status}`)}</span></span>
                                    <span className="ap-card-sub">{timeAgo(item.created_at, language, a)}</span>
                                </div>
                            ))}
                        </section>
                    </div>
                </div>
            )}


            {/* =================================================
                PEOPLE
            ================================================= */}

            {tab === "users" && (
                <section className="ap-section ap-fade">
                    <Toolbar query={query} setQuery={setQuery} placeholder={t("search")} filter={filter} setFilter={setFilter}
                        options={[["ALL", t("all")], ["SHIPPER", a("role_SHIPPER")], ["DRIVER", a("role_DRIVER")], ["FARMER", a("role_FARMER")]]} />
                    <Table
                        empty={t("noMatch")}
                        head={[t("name"), t("role"), t("phone"), t("country"), t("vehicle"), t("rating"), t("trips"), t("joined"), t("seen")]}
                        rows={users
                            .filter((item) => filter === "ALL" || item.role === filter)
                            .filter((item) => matches(query, item.full_name, item.phone_number, item.base_city, item.plate_number, item.vehicle_type))
                            .map((item) => [
                                item.id,
                                <><strong>{item.full_name}</strong>{item.base_city && <div className="ap-card-sub">📍 {item.base_city}</div>}</>,
                                <span key="c467" className="ap-chip">{ROLE_ICONS[item.role]} {a(`role_${item.role}`)}</span>,
                                <a key="c468" href={telHref(item.phone_number)} className="ts-link">{formatPhone(item.phone_number)}</a>,
                                `${findCountry(item.country)?.flag || ""} ${item.country || "CM"}`,
                                item.role === "DRIVER" ? <>{item.vehicle_type || "—"}<div className="ap-card-sub">{item.plate_number}{item.is_available ? ` · ✅ ${t("available")}` : ""}</div></> : "—",
                                item.rating_count ? `★ ${item.rating} (${item.rating_count})` : "—",
                                item.total_completed_shipments || 0,
                                timeAgo(item.created_at, language, a),
                                item.last_seen ? timeAgo(item.last_seen, language, a) : "—",
                            ])}
                    />
                </section>
            )}


            {/* =================================================
                LOADS
            ================================================= */}

            {tab === "loads" && (
                <section className="ap-section ap-fade">
                    <Toolbar query={query} setQuery={setQuery} placeholder={t("search")} filter={filter} setFilter={setFilter}
                        options={[["ALL", t("all")], ...["OPEN", "MATCHED", "DEPARTED", "ARRIVED", "COMPLETED", "CANCELLED"].map((status) => [status, a(`load_${status}`)])]} />
                    <Table
                        empty={t("noMatch")}
                        head={[t("route"), t("cargo"), t("price"), t("status"), t("offers"), t("shipper"), t("driver"), t("posted_at")]}
                        rows={shipments
                            .filter((item) => filter === "ALL" || item.status === filter)
                            .filter((item) => matches(query, item.origin, item.destination, item.item_type, item.shipper_name, item.driver_name, item.shipper_phone))
                            .map((item) => [
                                item.id,
                                <><strong>{item.origin_city || item.origin} → {item.destination_city || item.destination}</strong>{item.order_id && <div className="ap-card-sub">🌾 Marché</div>}</>,
                                `${item.quantity} × ${cargoLabel(item.item_type, language)}`,
                                <span key="c499" className="num">{formatMoney(item.agreed_price ?? item.initial_offer, item.currency)}</span>,
                                <span key="c500" className={`ap-chip ${LOAD_TONES[item.status] || ""}`}>{a(`load_${item.status}`)}</span>,
                                bidCount.get(item.id) || 0,
                                item.shipper_name || byId.get(item.shipper_id)?.full_name || "—",
                                item.driver_name || "—",
                                timeAgo(item.created_at, language, a),
                            ])}
                    />
                </section>
            )}


            {/* =================================================
                MARKET
            ================================================= */}

            {tab === "market" && (
                <>
                    <section className="ap-section ap-fade">
                        <SectionHead title={`🧺 ${t("products")}`} count={products.length} />
                        <Table
                            empty={t("nothing")}
                            head={[t("product"), t("farmer"), t("city"), t("price"), t("stock"), t("photos"), t("status")]}
                            rows={products.map((item) => [
                                item.id,
                                <strong key="c524">{productEmoji(item.product)} {productName(item, language)}</strong>,
                                byId.get(item.farmer_id)?.full_name || "—",
                                `${findCountry(item.country)?.flag || ""} ${item.city}`,
                                <span key="c527" className="num">{formatMoney(item.price_per_unit, item.currency)} / {unitName(item.unit, language)}</span>,
                                `${formatAmount(item.quantity_available)} ${unitName(item.unit, language, item.quantity_available)}`,
                                item.photo_count || 0,
                                <span key="c530" className="ap-chip">{item.status}</span>,
                            ])}
                        />
                    </section>

                    <section className="ap-section">
                        <SectionHead title={`🛒 ${t("orders")}`} count={orders.length} />
                        <Table
                            empty={t("nothing")}
                            head={["#", t("product"), t("total"), t("status"), t("buyer"), t("farmer"), t("delivery"), t("posted_at")]}
                            rows={orders.map((item) => [
                                item.id,
                                <strong key="c542">{orderReference(item.id)}</strong>,
                                `${formatAmount(item.quantity)} ${unitName(item.unit, language, item.quantity)} · ${productName(item, language)}`,
                                <span key="c544" className="num">{formatMoney(item.total_price, item.currency)}</span>,
                                <span key="c545" className={`ap-chip ${ORDER_TONES[item.status] || ""}`}>{item.status}</span>,
                                item.buyer_name || byId.get(item.buyer_id)?.full_name || "—",
                                item.farmer_name || byId.get(item.farmer_id)?.full_name || "—",
                                item.delivery_method === "PICKUP" ? t("pickup") : `🚚 ${item.delivery_city || ""}`,
                                timeAgo(item.created_at, language, a),
                            ])}
                        />
                    </section>
                </>
            )}


            {/* =================================================
                ACTIVITY
            ================================================= */}

            {tab === "activity" && (
                <div className="ap-two ap-fade">
                    <section>
                        <SectionHead title={`💬 ${t("bids")}`} count={bids.length} />
                        <Table
                            empty={t("nothing")}
                            head={[t("driver"), t("price"), t("status"), t("posted_at")]}
                            rows={bids.slice(0, 200).map((bid) => {
                                const load = shipments.find((item) => item.id === bid.shipment_id);
                                return [
                                    bid.id,
                                    <>{byId.get(bid.driver_id)?.full_name || "—"}<div className="ap-card-sub">{load ? `${load.origin_city} → ${load.destination_city}` : ""}</div></>,
                                    <span key="c573" className="num">{formatMoney(bid.counter_price ?? bid.proposed_price, load?.currency)}</span>,
                                    <span key="c574" className="ap-chip">{bid.status}</span>,
                                    timeAgo(bid.created_at, language, a),
                                ];
                            })}
                        />
                    </section>
                    <section>
                        <SectionHead title={`🔔 ${t("notifications")}`} count={notifications.length} />
                        <div className="ap-card" style={{ gap: 0, padding: 8 }}>
                            {notifications.length === 0 ? <Empty icon="🔔" title={t("nothing")} /> : notifications.slice(0, 60).map((item) => (
                                <div key={item.id} className="ap-notif" style={{ cursor: "default" }}>
                                    <i aria-hidden="true" style={{ background: item.read ? "transparent" : "var(--ts-orange)" }} />
                                    <div>
                                        <strong>{item.title}</strong>
                                        {item.message && <p>{item.message}</p>}
                                        <small>{byId.get(item.user_id)?.full_name || "—"} · {timeAgo(item.created_at, language, a)}</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

        </AppShell>
    );
}


/* =========================================================
   PIECES
========================================================= */

function Toolbar({ query, setQuery, placeholder, filter, setFilter, options }) {
    return (
        <div className="ap-section-head" style={{ alignItems: "center" }}>
            <input
                className="mk-input ap-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            <div className="ap-chips">
                {options.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        className={`ap-chip ${filter === key ? "ap-chip-ink" : ""}`}
                        style={{ border: 0, cursor: "pointer" }}
                        onClick={() => setFilter(key)}
                        aria-pressed={filter === key}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Table({ head, rows, empty }) {
    if (rows.length === 0) {
        return <Empty icon="🔍" title={empty} />;
    }

    return (
        <div className="ap-table-wrap">
            <table className="ap-table">
                <thead>
                    <tr>
                        {head.map((label) => <th key={label}>{label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 300).map(([id, ...cells]) => (
                        <tr key={id}>
                            {cells.map((cell, index) => <td key={index}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
