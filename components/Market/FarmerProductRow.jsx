import Link from "next/link";

import { ProductThumb } from "./ProductMedia";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, useMarketText } from "../../lib/marketText";
import { formatAmount, productName, unitName } from "../../lib/produce";
import { shareListingOnWhatsApp } from "../../lib/shareLoad";

const STATUS_PILL = {
    ACTIVE: "mk-pill-green",
    PAUSED: "",
    SOLD_OUT: "mk-pill-red",
};

/*
 * One of the farmer's products, with share, edit, pause,
 * resume, view and remove.
 */
export default function FarmerProductRow({ product, busy, onEdit, onStatus }) {
    const { language } = useLanguage();

    const m = useMarketText();

    return (
        <div className="mk-product-row">

            <ProductThumb item={product} />

            <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: "#0f172a", fontSize: 15 }}>
                        {productName(product, language)}
                    </strong>
                    <span className={`mk-pill ${STATUS_PILL[product.status] || ""}`}>
                        {m(`status_${product.status}`)}
                    </span>
                </div>

                <div className="mk-card-meta" style={{ marginTop: 4 }}>
                    <strong style={{ color: "#0f172a" }}>
                        {formatAmount(product.price_per_unit)} FCFA
                    </strong>{" "}
                    / {unitName(product.unit, language)} ·{" "}
                    {m("available", {
                        quantity: formatAmount(product.quantity_available),
                        unit: unitName(product.unit, language, product.quantity_available),
                    })}
                </div>

                <div className="mk-card-meta">
                    📍 {product.area ? `${product.area}, ` : ""}{product.city}
                    {" · "}
                    {product.ready_now
                        ? m("readyNow")
                        : m("readyOn", { date: formatDay(product.available_from, language) })}
                </div>

                {product.status === "ACTIVE" && !product.visible && (
                    <div className="mk-card-meta" style={{ color: "#b91c1c" }}>
                        {m("hiddenExpired")}
                    </div>
                )}
            </div>

            <div className="mk-actions" style={{ justifyContent: "flex-end" }}>
                {product.visible && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-whatsapp mk-btn-sm"
                        onClick={() => shareListingOnWhatsApp(product, language)}
                    >
                        💬 {m("share")}
                    </button>
                )}

                <button
                    type="button"
                    className="mk-btn mk-btn-light mk-btn-sm"
                    onClick={() => onEdit(product)}
                >
                    ✏️ {m("edit")}
                </button>

                {product.status === "ACTIVE" && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-light mk-btn-sm"
                        disabled={busy}
                        onClick={() => onStatus(product, "PAUSED")}
                    >
                        ⏸ {m("pause")}
                    </button>
                )}

                {product.status !== "ACTIVE" && Number(product.quantity_available) > 0 && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-light mk-btn-sm"
                        disabled={busy}
                        onClick={() => onStatus(product, "ACTIVE")}
                    >
                        ▶ {m("resume")}
                    </button>
                )}

                <Link href={`/market/${product.id}`} className="mk-btn mk-btn-ghost mk-btn-sm">
                    {m("viewOnMarket")}
                </Link>

                <button
                    type="button"
                    className="mk-btn mk-btn-ghost mk-btn-sm"
                    disabled={busy}
                    onClick={() => onStatus(product, "ARCHIVED")}
                >
                    {m("remove")}
                </button>
            </div>

        </div>
    );
}
