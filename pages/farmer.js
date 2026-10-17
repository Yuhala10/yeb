import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import BrandLogo from "../components/BrandLogo";
import DeleteAccount from "../components/Account/DeleteAccount";
import Notifications from "../components/Notifications";
import OrderCard from "../components/Market/OrderCard";
import ProductForm from "../components/Market/ProductForm";
import FarmerProductRow from "../components/Market/FarmerProductRow";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { useLanguage } from "../lib/LanguageContext";
import { marketError, useMarketText } from "../lib/marketText";
import { formatAmount } from "../lib/produce";

/*
 * ============================================================
 * FARMER DASHBOARD — TAYEB MARCHÉ
 * ============================================================
 *
 * New orders first (they expire after 48 hours), then orders
 * in progress with the driver coming to collect, then the
 * farmer's products. Refreshes every 20 seconds.
 */


export default function FarmerPage() {
    const router = useRouter();

    const { language, setLanguage } = useLanguage();

    const m = useMarketText();

    const [user, setUser] = useState(null);

    const [data, setData] = useState(null);

    const [busyId, setBusyId] = useState(null);

    const [editing, setEditing] = useState(null);

    const [flash, setFlash] = useState("");

    function goToLogin() {
        localStorage.removeItem("tayebUser");
        localStorage.removeItem("selectedRole");
        router.replace("/login");
    }

    async function load() {
        try {
            const result = await apiGet("/api/farmer");

            setData(result);
            setUser(result.user);
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                goToLogin();
            }
        }
    }

    /* ---------------- session ---------------- */

    useEffect(() => {
        let alive = true;

        apiGet("/api/session/me")
            .then((result) => {
                if (!alive) {
                    return;
                }

                if (result.user?.role !== "FARMER") {
                    goToLogin();
                    return;
                }

                setUser(result.user);
                localStorage.setItem("selectedRole", "FARMER");
            })
            .catch(() => alive && goToLogin());

        return () => {
            alive = false;
        };
        // Runs once when the page opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        return pollWhileVisible(load, 20000);
        // load only sets state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    /* ---------------- groups ---------------- */

    const orders = useMemo(() => data?.orders || [], [data]);

    const products = useMemo(() => data?.products || [], [data]);

    const newOrders = orders.filter((order) => order.status === "PENDING");

    const activeOrders = orders.filter((order) => order.status === "CONFIRMED" || (order.status === "COMPLETED" && !order.paid_at));

    const history = orders.filter((order) => !newOrders.includes(order) && !activeOrders.includes(order)).slice(0, 20);

    const onSale = products.filter((item) => item.visible);

    /* ---------------- actions ---------------- */

    function showFlash(text) {
        setFlash(text);
        setTimeout(() => setFlash(""), 4000);
    }

    async function orderAction(action, order, extra = {}) {
        if (action === "confirm" && !window.confirm(m("confirmQuestion"))) {
            return;
        }

        if (action === "paid" && !window.confirm(m("markPaidQuestion", { amount: formatAmount(order.total_price) }))) {
            return;
        }

        setBusyId(order.id);

        try {
            await apiPost("/api/farmer", { action, orderId: order.id, ...extra });

            if (action === "confirm") {
                showFlash(m("confirmedText"));
            }

            await load();
        } catch (error) {
            alert(marketError(language, error));
            await load();
        } finally {
            setBusyId(null);
        }
    }

    async function setProductStatus(product, status) {
        if (status === "ARCHIVED" && !window.confirm(m("confirmRemove"))) {
            return;
        }

        setBusyId(product.id);

        try {
            await apiPost("/api/farmer", { action: "productStatus", productId: product.id, status });
            await load();
        } catch (error) {
            alert(marketError(language, error));
        } finally {
            setBusyId(null);
        }
    }

    async function productSaved(product, isNew) {
        setEditing(null);
        showFlash(isNew ? m("published") : m("saved"));
        await load();
    }

    async function logout() {
        try {
            await fetch("/api/session/logout", { method: "POST", credentials: "include" });
        } finally {
            goToLogin();
        }
    }

    /* ---------------- loading ---------------- */

    if (!user || !data) {
        return (
            <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff" }}>
                <div style={{ textAlign: "center" }}>
                    <BrandLogo width={130} height={48} />
                    <div style={{ marginTop: 22 }}>
                        <span className="tayeb-spinner tayeb-spinner-orange" />
                    </div>
                </div>
            </main>
        );
    }

    return (
        <>
            <Head>
                <title>{`Tayeb Marché — ${m("farmerSubtitle")}`}</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="tayeb-app">

                {/* =================================================
                    TOP BAR
                ================================================= */}

                <header className="tayeb-topbar">

                    <div className="tayeb-topbar-left">
                        <BrandLogo width={105} height={40} />
                        <Link href="/market" className="mk-brand-tag" style={{ textDecoration: "none" }}>
                            🌾 MARCHÉ
                        </Link>
                    </div>

                    <div className="tayeb-topbar-right">

                        <div className="mk-lang" role="group" aria-label="Language">
                            <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
                                EN
                            </button>
                            <button type="button" className={language === "fr" ? "active" : ""} onClick={() => setLanguage("fr")}>
                                FR
                            </button>
                        </div>

                        <Notifications userId={user.id} />

                        <div className="tayeb-avatar" title={user.full_name}>
                            {user.full_name?.charAt(0)?.toUpperCase() || "T"}
                        </div>

                    </div>

                </header>


                <div className="tayeb-dashboard">

                    {/* =================================================
                        WELCOME
                    ================================================= */}

                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>

                        <div>
                            <span className="tayeb-section-label">TAYEB MARCHÉ</span>
                            <h1 style={{ color: "#111827", fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 1, letterSpacing: "-0.05em", fontWeight: 900 }}>
                                {m("farmerGreeting")}, <span style={{ color: "#15803d" }}>{user.full_name}</span>
                            </h1>
                            <p style={{ marginTop: 10, color: "#6b7280", fontSize: 14 }}>
                                👨🏾‍🌾 {m("farmerSubtitle")}
                                {user.base_city ? ` · ${user.base_city}` : ""}
                            </p>
                        </div>

                        <button type="button" onClick={logout} className="tayeb-button tayeb-button-secondary">
                            {language === "fr" ? "Se déconnecter" : "Log out"}
                        </button>

                    </div>

                    {!data.ready && (
                        <div className="mk-empty" style={{ marginBottom: 24 }}>
                            <div className="mk-empty-icon">🌱</div>
                            <h3>{m("notReadyTitle")}</h3>
                            <p>{m("notReadyText")}</p>
                        </div>
                    )}

                    {flash && (
                        <div className="mk-notice mk-notice-green tayeb-fade-in" style={{ marginBottom: 18 }} role="status">
                            ✓ {flash}
                        </div>
                    )}


                    {/* =================================================
                        SUMMARY
                    ================================================= */}

                    <div className="tayeb-dashboard-grid" style={{ marginBottom: 22 }}>
                        {[
                            ["🧺", onSale.length, m("statProducts")],
                            ["🛒", newOrders.length, m("statNewOrders")],
                            ["🚚", orders.filter((order) => order.status === "CONFIRMED").length, m("statInProgress")],
                            ["✓", user.total_completed_shipments || 0, m("statSales")],
                        ].map(([icon, value, label]) => (
                            <div key={label} className="tayeb-span-3">
                                <div className="tayeb-stat-card">
                                    <div className="tayeb-stat-icon">{icon}</div>
                                    <div className="tayeb-stat-label" style={{ fontSize: 12 }}>{label}</div>
                                    <div className="tayeb-stat-value">{value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {data.ready && (
                        <button
                            type="button"
                            className="mk-btn mk-btn-primary mk-btn-lg"
                            onClick={() => setEditing({})}
                        >
                            ＋ {m("addProduct")}
                        </button>
                    )}


                    {/* =================================================
                        NEW ORDERS
                    ================================================= */}

                    {data.ready && (
                        <>
                            <div className="mk-section-head">
                                <h2>🛒 {m("newOrders")}</h2>
                                {newOrders.length > 0 && <span className="mk-count">{newOrders.length}</span>}
                            </div>

                            {newOrders.length === 0 ? (
                                <div className="mk-notice">{m("noNewOrders")}</div>
                            ) : (
                                <div className="mk-list">
                                    {newOrders.map((order) => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            role="farmer"
                                            busy={busyId === order.id}
                                            onAction={orderAction}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}


                    {/* =================================================
                        IN PROGRESS
                    ================================================= */}

                    {activeOrders.length > 0 && (
                        <>
                            <div className="mk-section-head">
                                <h2>🚚 {m("inProgress")}</h2>
                                <span className="mk-count" style={{ background: "#2563eb" }}>{activeOrders.length}</span>
                            </div>

                            <div className="mk-list">
                                {activeOrders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        role="farmer"
                                        busy={busyId === order.id}
                                        onAction={orderAction}
                                    />
                                ))}
                            </div>
                        </>
                    )}


                    {/* =================================================
                        PRODUCTS
                    ================================================= */}

                    {data.ready && (
                        <>
                            <div className="mk-section-head">
                                <h2>🧺 {m("myProducts")}</h2>
                            </div>

                            {products.length === 0 ? (
                                <div className="mk-empty">
                                    <div className="mk-empty-icon">🌱</div>
                                    <h3>{m("noProducts")}</h3>
                                    <p>{m("noProductsText")}</p>
                                    <button type="button" className="mk-btn mk-btn-primary" onClick={() => setEditing({})}>
                                        ＋ {m("addProduct")}
                                    </button>
                                </div>
                            ) : (
                                <div className="mk-list">
                                    {products.map((product) => (
                                        <FarmerProductRow
                                            key={product.id}
                                            product={product}
                                            busy={busyId === product.id}
                                            onEdit={setEditing}
                                            onStatus={setProductStatus}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}


                    {/* =================================================
                        HISTORY
                    ================================================= */}

                    {history.length > 0 && (
                        <>
                            <div className="mk-section-head">
                                <h2>🗂️ {m("history")}</h2>
                            </div>

                            <div className="mk-list">
                                {history.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        role="farmer"
                                        busy={busyId === order.id}
                                        onAction={orderAction}
                                    />
                                ))}
                            </div>
                        </>
                    )}


                    <footer style={{ marginTop: 50, paddingTop: 25, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
                        <BrandLogo width={95} height={36} />
                        <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>
                            Tayeb Marché · {m("tagline")}
                        </p>
                    </footer>

                </div>

                <DeleteAccount user={user} />

            </main>

            {editing && (
                <ProductForm
                    product={editing.id ? editing : null}
                    farmer={user}
                    onClose={() => setEditing(null)}
                    onDone={productSaved}
                />
            )}
        </>
    );
}
