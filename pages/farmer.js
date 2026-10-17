import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AccountPanel from "../components/App/AccountPanel";
import AppShell from "../components/App/AppShell";
import { AppLoading, Empty, SectionHead } from "../components/App/Bits";
import { useFeedback } from "../components/App/Feedback";
import FarmerProductRow from "../components/Market/FarmerProductRow";
import OrderCard from "../components/Market/OrderCard";
import ProductForm from "../components/Market/ProductForm";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { useAppText } from "../lib/appText";
import { useLanguage } from "../lib/LanguageContext";
import { marketError, useMarketText } from "../lib/marketText";
import { formatMoney } from "../lib/money";
import { formatAmount } from "../lib/produce";
import { leaveDashboard, useRoleUser } from "../lib/useSession";

/*
 * ============================================================
 * FARMER — TAYEB MARCHÉ
 * ============================================================
 *
 * New orders first (they expire after 48 hours), then orders
 * on their way, the farmer's products and the history.
 * Refreshes every 20 seconds while open.
 */
export default function FarmerPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const m = useMarketText();

    const { toast, confirm } = useFeedback();

    const [user, setUser] = useRoleUser("FARMER");

    const [data, setData] = useState(null);

    const [tab, setTab] = useState("orders");

    const [busyId, setBusyId] = useState(null);

    const [editing, setEditing] = useState(null);

    async function load() {
        try {
            const result = await apiGet("/api/farmer");

            setData(result);
            setUser(result.user);
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                leaveDashboard(router, "FARMER");
            }
        }
    }

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

    const history = orders.filter((order) => !newOrders.includes(order) && !activeOrders.includes(order)).slice(0, 30);

    const onSale = products.filter((item) => item.visible);

    const sales = orders.filter((order) => order.status === "COMPLETED").reduce((sums, order) => {
        const code = order.currency || "XAF";
        sums[code] = (sums[code] || 0) + Number(order.total_price || 0);
        return sums;
    }, {});

    const salesText = Object.entries(sales).map(([code, total]) => formatMoney(total, code)).join(" · ");

    /* ---------------- actions ---------------- */

    async function orderAction(action, order, extra = {}) {
        if (action === "confirm" && !(await confirm({ title: m("confirmQuestion"), confirmLabel: m("confirm"), icon: "✅" }))) {
            return;
        }

        if (action === "paid" && !(await confirm({ title: m("markPaidQuestion", { amount: formatAmount(order.total_price) }), confirmLabel: m("markPaid"), icon: "💵" }))) {
            return;
        }

        setBusyId(order.id);

        try {
            await apiPost("/api/farmer", { action, orderId: order.id, ...extra });

            if (action === "confirm") {
                toast(m("confirmedText"), "success");
            }
        } catch (error) {
            toast(marketError(language, error), "error");
        } finally {
            setBusyId(null);
            await load();
        }
    }

    async function setProductStatus(product, status) {
        if (status === "ARCHIVED" && !(await confirm({ title: m("confirmRemove"), tone: "danger", icon: "🗑️" }))) {
            return;
        }

        setBusyId(product.id);

        try {
            await apiPost("/api/farmer", { action: "productStatus", productId: product.id, status });
            await load();
        } catch (error) {
            toast(marketError(language, error), "error");
        } finally {
            setBusyId(null);
        }
    }

    async function productSaved(product, isNew) {
        setEditing(null);
        toast(isNew ? m("published") : m("saved"), "success");
        setTab("products");
        await load();
    }

    /* ---------------- screen ---------------- */

    if (!user || !data) {
        return <AppLoading />;
    }

    const tabs = [
        { key: "orders", label: a("f_tabOrders"), icon: "🛒", count: newOrders.length },
        { key: "products", label: a("f_tabProducts"), icon: "🧺", count: 0 },
        { key: "profile", label: a("f_tabProfile"), icon: "👤" },
    ];

    return (
        <AppShell
            user={user}
            pageTitle={m("farmerSubtitle")}
            eyebrow={`🌾 Tayeb Marché${user.base_city ? ` · 📍 ${user.base_city}` : ""}`}
            title={<>{a("helloWord")}, <em>{String(user.full_name || "").split(/\s+/)[0]}</em></>}
            subtitle={a("f_sub")}
            actions={
                data.ready && (
                    <button type="button" className="ts-btn ts-btn-primary" onClick={() => setEditing({})}>
                        ＋ {m("addProduct")}
                    </button>
                )
            }
            stats={[
                { value: onSale.length, label: a("f_statOnSale") },
                { value: newOrders.length, label: a("f_statNew"), hot: newOrders.length > 0 },
                { value: orders.filter((order) => order.status === "CONFIRMED").length, label: a("f_statLive") },
                { value: user.total_completed_shipments || 0, label: a("f_statSales"), small: salesText || null },
            ]}
            tabs={tabs}
            tab={tab}
            onTab={setTab}
        >

            {!data.ready && (
                <Empty icon="🌱" title={m("notReadyTitle")} text={m("notReadyText")} />
            )}

            {/* =================================================
                ORDERS
            ================================================= */}

            {data.ready && tab === "orders" && (
                <>
                    <section className="ap-section ap-fade">
                        <SectionHead title={`🛒 ${m("newOrders")}`} count={newOrders.length} />

                        {newOrders.length === 0 ? (
                            <Empty icon="🛒" title={m("noNewOrders")} text={products.length === 0 ? m("noProductsText") : null}>
                                {products.length === 0 && (
                                    <button type="button" className="ts-btn ts-btn-primary" onClick={() => setEditing({})}>
                                        ＋ {m("addProduct")}
                                    </button>
                                )}
                            </Empty>
                        ) : (
                            <div className="ap-stack">
                                {newOrders.map((order) => (
                                    <OrderCard key={order.id} order={order} role="farmer" busy={busyId === order.id} onAction={orderAction} />
                                ))}
                            </div>
                        )}
                    </section>

                    {activeOrders.length > 0 && (
                        <section className="ap-section">
                            <SectionHead title={`🚚 ${m("inProgress")}`} count={activeOrders.length} />
                            <div className="ap-stack">
                                {activeOrders.map((order) => (
                                    <OrderCard key={order.id} order={order} role="farmer" busy={busyId === order.id} onAction={orderAction} />
                                ))}
                            </div>
                        </section>
                    )}

                    {history.length > 0 && (
                        <section className="ap-section">
                            <SectionHead title={`🗂️ ${m("history")}`} />
                            <div className="ap-stack">
                                {history.map((order) => (
                                    <OrderCard key={order.id} order={order} role="farmer" busy={busyId === order.id} onAction={orderAction} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}


            {/* =================================================
                PRODUCTS
            ================================================= */}

            {data.ready && tab === "products" && (
                <section className="ap-section ap-fade">
                    <SectionHead title={`🧺 ${m("myProducts")}`}>
                        <div className="ap-actions">
                            <Link href="/market" className="ts-btn ts-btn-light ts-btn-sm">🌾 {a("menuMarket")}</Link>
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-sm" onClick={() => setEditing({})}>
                                ＋ {m("addProduct")}
                            </button>
                        </div>
                    </SectionHead>

                    {products.length === 0 ? (
                        <Empty icon="🌱" title={m("noProducts")} text={m("noProductsText")}>
                            <button type="button" className="ts-btn ts-btn-primary" onClick={() => setEditing({})}>
                                ＋ {m("addProduct")}
                            </button>
                        </Empty>
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
                </section>
            )}


            {/* =================================================
                PROFILE
            ================================================= */}

            {tab === "profile" && (
                <section className="ap-section ap-fade">
                    <SectionHead title={a("f_tabProfile")} />
                    <div style={{ maxWidth: 720 }}>
                        <AccountPanel user={user}>
                            {(salesText || user.rating_count > 0) && (
                                <div className="ap-kv">
                                    {salesText && (
                                        <div>
                                            <small>{a("f_statSales")}</small>
                                            <strong>{salesText}</strong>
                                        </div>
                                    )}
                                    {user.rating_count > 0 && (
                                        <div>
                                            <small>★</small>
                                            <strong>{user.rating}/5 ({user.rating_count})</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                        </AccountPanel>
                    </div>
                </section>
            )}

            {editing && (
                <ProductForm
                    product={editing.id ? editing : null}
                    farmer={user}
                    onClose={() => setEditing(null)}
                    onDone={productSaved}
                />
            )}

        </AppShell>
    );
}
