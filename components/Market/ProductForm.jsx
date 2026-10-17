import { useEffect, useRef, useState } from "react";

import { ProductThumb } from "./ProductMedia";
import { apiGet, apiPost } from "../../lib/api";
import { CITY_NAMES } from "../../lib/cities";
import { compressImage } from "../../lib/image";
import { useLanguage } from "../../lib/LanguageContext";
import { marketError, useMarketText } from "../../lib/marketText";
import { PRODUCTS, UNITS, cameroonToday, findProduct, findUnit, formatAmount, unitName } from "../../lib/produce";

function initialState(product, farmer) {
    if (product) {
        return {
            id: product.id,
            product: product.product,
            customName: product.custom_name || "",
            details: product.details || "",
            unit: product.unit,
            unitWeightKg: product.unit_weight_kg ? String(product.unit_weight_kg) : "",
            pricePerUnit: String(product.price_per_unit || ""),
            quantity: String(product.quantity_available ?? ""),
            minOrder: String(product.min_order ?? "1"),
            city: product.city,
            area: product.area || "",
            availableFrom: product.available_from || cameroonToday(),
            availableUntil: product.available_until || "",
            perishable: Boolean(product.perishable),
        };
    }

    return {
        id: null,
        product: "",
        customName: "",
        details: "",
        unit: "",
        unitWeightKg: "",
        pricePerUnit: "",
        quantity: "",
        minOrder: "1",
        city: farmer?.base_city || "",
        area: "",
        availableFrom: cameroonToday(),
        availableUntil: "",
        perishable: false,
    };
}

/*
 * Add or edit a product. onDone(product, isNew) after a
 * successful save (and photo upload).
 */
export default function ProductForm({ product, farmer, onClose, onDone }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const [form, setForm] = useState(() => initialState(product, farmer));

    const [photo, setPhoto] = useState(null);

    const [preview, setPreview] = useState(product?.photo_url || "");

    const [prices, setPrices] = useState(null);

    const [saving, setSaving] = useState(false);

    const [status, setStatus] = useState("");

    const [error, setError] = useState("");

    const fileInput = useRef(null);

    // Editing: show market prices for the product right away.
    useEffect(() => {
        if (!product?.product || product.product === "OTHER") {
            return;
        }

        let alive = true;

        apiGet(`/api/market?prices=${encodeURIComponent(product.product)}`)
            .then((result) => {
                if (alive) {
                    setPrices(result);
                }
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, [product]);

    const unit = findUnit(form.unit);

    const unitOne = form.unit ? unitName(form.unit, language) : "…";

    const unitMany = form.unit ? unitName(form.unit, language, 2) : "…";

    const unitPrices = prices?.units?.[form.unit] || null;

    function update(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function loadPrices(productKey) {
        setPrices(null);

        if (!productKey || productKey === "OTHER") {
            return;
        }

        try {
            setPrices(await apiGet(`/api/market?prices=${encodeURIComponent(productKey)}`));
        } catch {
            setPrices(null);
        }
    }

    function chooseProduct(key) {
        const catalog = findProduct(key);

        setForm((current) => ({
            ...current,
            product: key,
            unit: current.unit || catalog?.unit || "",
            perishable: catalog ? catalog.perishable : current.perishable,
        }));

        loadPrices(key);
    }

    async function choosePhoto(event) {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        setError("");

        try {
            const dataUrl = await compressImage(file);

            setPhoto(dataUrl);
            setPreview(dataUrl);
        } catch (failure) {
            setError(failure.message);
        }
    }

    async function save(event) {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSaving(true);
        setError("");
        setStatus("");

        try {
            const { product: saved } = await apiPost("/api/farmer", {
                action: "saveProduct",
                ...form,
            });

            if (photo) {
                setStatus(m("uploading"));

                const { photo_url } = await apiPost("/api/farmer", {
                    action: "photo",
                    productId: saved.id,
                    image: photo,
                });

                saved.photo_url = photo_url;
            }

            onDone(saved, !form.id);
        } catch (failure) {
            setError(marketError(language, failure));
        } finally {
            setSaving(false);
            setStatus("");
        }
    }

    return (
        <div className="mk-modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => event.target === event.currentTarget && !saving && onClose()}>

            <form className="mk-modal" onSubmit={save}>

                <div className="mk-modal-head">
                    <h2>{form.id ? m("editFormTitle") : m("productFormTitle")}</h2>
                    <button type="button" className="mk-close" onClick={onClose} disabled={saving} aria-label={m("cancel")}>
                        ✕
                    </button>
                </div>

                <div style={{ display: "grid", gap: 16 }}>

                    {/* PHOTO */}

                    <div className="mk-photo-pick">
                        <ProductThumb item={{ product: form.product, photo_url: preview }} />

                        <div style={{ display: "grid", gap: 6 }}>
                            <button
                                type="button"
                                className="mk-btn mk-btn-light mk-btn-sm"
                                onClick={() => fileInput.current?.click()}
                                disabled={saving}
                            >
                                📷 {preview ? m("changePhoto") : m("addPhoto")}
                            </button>
                            <small style={{ color: "var(--mk-muted)", fontSize: 12 }}>{m("photoHint")}</small>
                        </div>

                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            hidden
                            onChange={choosePhoto}
                        />
                    </div>


                    {/* WHAT */}

                    <div className="mk-field">
                        <label htmlFor="pf-product">{m("product")}</label>
                        <select
                            id="pf-product"
                            className="mk-select"
                            required
                            value={form.product}
                            onChange={(event) => chooseProduct(event.target.value)}
                        >
                            <option value="">{m("chooseProduct")}</option>
                            {PRODUCTS.map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.emoji} {language === "fr" ? item.fr : item.en}
                                </option>
                            ))}
                        </select>
                    </div>

                    {form.product === "OTHER" && (
                        <div className="mk-field">
                            <label htmlFor="pf-name">{m("customName")}</label>
                            <input
                                id="pf-name"
                                className="mk-input"
                                required
                                maxLength={60}
                                value={form.customName}
                                onChange={(event) => update("customName", event.target.value)}
                            />
                        </div>
                    )}

                    <div className="mk-row">
                        <div className="mk-field">
                            <label htmlFor="pf-unit">{m("unit")}</label>
                            <select
                                id="pf-unit"
                                className="mk-select"
                                required
                                value={form.unit}
                                onChange={(event) => update("unit", event.target.value)}
                            >
                                <option value="">—</option>
                                {UNITS.map((item) => (
                                    <option key={item.key} value={item.key}>
                                        {language === "fr" ? item.fr : item.en}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {unit && unit.kg === null && (
                            <div className="mk-field">
                                <label htmlFor="pf-weight">{m("unitWeight", { unit: unitOne })}</label>
                                <input
                                    id="pf-weight"
                                    className="mk-input"
                                    inputMode="decimal"
                                    value={form.unitWeightKg}
                                    onChange={(event) => update("unitWeightKg", event.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
                                    placeholder="25"
                                />
                            </div>
                        )}
                    </div>


                    {/* PRICE AND STOCK */}

                    <div className="mk-row">
                        <div className="mk-field">
                            <label htmlFor="pf-price">{m("pricePerUnit", { unit: unitOne })}</label>
                            <input
                                id="pf-price"
                                className="mk-input"
                                inputMode="numeric"
                                required
                                value={form.pricePerUnit}
                                onChange={(event) => update("pricePerUnit", event.target.value.replace(/[^\d]/g, "").slice(0, 9))}
                                placeholder="12000"
                            />
                        </div>

                        <div className="mk-field">
                            <label htmlFor="pf-stock">{m("stock", { unit: unitMany })}</label>
                            <input
                                id="pf-stock"
                                className="mk-input"
                                inputMode="decimal"
                                required
                                value={form.quantity}
                                onChange={(event) => update("quantity", event.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
                                placeholder="40"
                            />
                        </div>
                    </div>

                    {(unitPrices?.paid || unitPrices?.on_sale) && (
                        <div className="mk-notice mk-notice-green">
                            {unitPrices.paid && (
                                <div>
                                    📊 {m("priceOnMarket", {
                                        low: formatAmount(unitPrices.paid.low),
                                        high: formatAmount(unitPrices.paid.high),
                                        unit: unitOne,
                                        count: unitPrices.paid.count,
                                    })}
                                </div>
                            )}
                            {unitPrices.on_sale && (
                                <div>
                                    🏷️ {m("onSaleRange", {
                                        low: formatAmount(unitPrices.on_sale.low),
                                        high: formatAmount(unitPrices.on_sale.high),
                                        unit: unitOne,
                                        count: unitPrices.on_sale.count,
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mk-field">
                        <label htmlFor="pf-min">{m("minOrderLabel", { unit: unitMany })}</label>
                        <input
                            id="pf-min"
                            className="mk-input"
                            inputMode="decimal"
                            value={form.minOrder}
                            onChange={(event) => update("minOrder", event.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
                        />
                    </div>


                    {/* WHERE AND WHEN */}

                    <div className="mk-row">
                        <div className="mk-field">
                            <label htmlFor="pf-city">{m("city")}</label>
                            <select
                                id="pf-city"
                                className="mk-select"
                                required
                                value={form.city}
                                onChange={(event) => update("city", event.target.value)}
                            >
                                <option value="">{m("chooseCity")}</option>
                                {CITY_NAMES.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mk-field">
                            <label htmlFor="pf-area">{m("area")}</label>
                            <input
                                id="pf-area"
                                className="mk-input"
                                maxLength={80}
                                value={form.area}
                                onChange={(event) => update("area", event.target.value)}
                                placeholder="Foumbot"
                            />
                        </div>
                    </div>

                    <div className="mk-row">
                        <div className="mk-field">
                            <label htmlFor="pf-from">{m("availableFrom")}</label>
                            <input
                                id="pf-from"
                                type="date"
                                className="mk-input"
                                value={form.availableFrom}
                                onChange={(event) => update("availableFrom", event.target.value)}
                            />
                        </div>

                        <div className="mk-field">
                            <label htmlFor="pf-until">{m("availableUntil")}</label>
                            <input
                                id="pf-until"
                                type="date"
                                className="mk-input"
                                min={form.availableFrom || cameroonToday()}
                                value={form.availableUntil}
                                onChange={(event) => update("availableUntil", event.target.value)}
                            />
                        </div>
                    </div>

                    <label className="mk-check">
                        <input
                            type="checkbox"
                            checked={form.perishable}
                            onChange={(event) => update("perishable", event.target.checked)}
                        />
                        ❄️ {m("perishable")}
                    </label>

                    <div className="mk-field">
                        <label htmlFor="pf-details">{m("details")}</label>
                        <textarea
                            id="pf-details"
                            className="mk-textarea"
                            maxLength={300}
                            value={form.details}
                            onChange={(event) => update("details", event.target.value)}
                            placeholder={m("detailsPlaceholder")}
                        />
                    </div>

                    {status && <div className="mk-notice mk-notice-blue">{status}</div>}

                    {error && <div className="mk-notice mk-notice-red" role="alert">{error}</div>}

                    <div className="mk-actions">
                        <button type="submit" className="mk-btn mk-btn-primary mk-btn-lg" disabled={saving}>
                            {saving ? <span className="tayeb-spinner" /> : form.id ? m("save") : `✓ ${m("publish")}`}
                        </button>
                        <button type="button" className="mk-btn mk-btn-light mk-btn-lg" onClick={onClose} disabled={saving}>
                            {m("cancel")}
                        </button>
                    </div>

                </div>

            </form>

        </div>
    );
}
