import { useEffect, useState } from "react";

import PhotoPicker from "./PhotoPicker";
import { apiGet, apiPost } from "../../lib/api";
import { cityNames } from "../../lib/cities";
import { countryOrDefault, todayIn } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { marketError, useMarketText } from "../../lib/marketText";
import { currencySymbol, formatMoney } from "../../lib/money";
import { CATEGORIES, PRODUCTS, UNITS, findProduct, findUnit, unitName } from "../../lib/produce";

function initialState(product, farmer) {
    const today = todayIn(farmer?.country);

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
            availableFrom: product.available_from || today,
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
        availableFrom: today,
        availableUntil: "",
        perishable: false,
    };
}

function initialPhotos(product) {
    return (product?.photos || []).map((photo, index) => ({
        id: `saved-${index}-${photo.url}`,
        url: photo.url,
        kind: "saved",
    }));
}

/*
 * Post or edit a product, with up to 8 photos.
 * onDone(product, isNew) after everything is saved.
 */
export default function ProductForm({ product, farmer, onClose, onDone }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const country = countryOrDefault(farmer?.country);

    const [form, setForm] = useState(() => initialState(product, farmer));

    const [photos, setPhotos] = useState(() => initialPhotos(product));

    const [prices, setPrices] = useState(null);

    const [saving, setSaving] = useState(false);

    const [status, setStatus] = useState("");

    const [error, setError] = useState("");

    // Editing: show market prices for the product right away.
    useEffect(() => {
        if (!product?.product || product.product === "OTHER") {
            return;
        }

        let alive = true;

        apiGet(`/api/market?prices=${encodeURIComponent(product.product)}&country=${country.code}`)
            .then((result) => {
                if (alive) {
                    setPrices(result);
                }
            })
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, [product, country.code]);

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
            setPrices(await apiGet(`/api/market?prices=${encodeURIComponent(productKey)}&country=${country.code}`));
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

    async function save(event) {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSaving(true);
        setError("");
        setStatus("");

        const isNew = !product?.id;

        try {
            const { product: saved } = await apiPost("/api/farmer", {
                action: "saveProduct",
                ...form,
            });

            // A retry after a failed upload updates this product
            // instead of creating a second one.
            setForm((current) => ({ ...current, id: saved.id }));

            // Upload the new photos one by one, keeping the chosen order.
            const working = [...photos];

            const newCount = working.filter((item) => item.kind === "new").length;

            let done = 0;

            const finalUrls = [];

            for (let position = 0; position < working.length; position++) {
                const item = working[position];

                if (item.kind === "saved") {
                    finalUrls.push(item.url);
                    continue;
                }

                done += 1;

                setStatus(
                    language === "fr"
                        ? `Envoi des photos ${done}/${newCount}…`
                        : `Uploading photos ${done}/${newCount}…`
                );

                const { photo_url } = await apiPost("/api/farmer", {
                    action: "addPhoto",
                    productId: saved.id,
                    image: item.dataUrl,
                });

                working[position] = { id: item.id, url: photo_url, kind: "saved" };

                setPhotos([...working]);

                finalUrls.push(photo_url);
            }

            const hadPhotos = (product?.photos || []).length > 0 || done > 0;

            if (finalUrls.length || hadPhotos) {
                const { photos: arranged } = await apiPost("/api/farmer", {
                    action: "arrangePhotos",
                    productId: saved.id,
                    urls: finalUrls,
                });

                saved.photos = arranged;
                saved.photo_url = arranged[0]?.url || null;
            }

            onDone(saved, isNew);
        } catch (failure) {
            setError(marketError(language, failure));
        } finally {
            setSaving(false);
            setStatus("");
        }
    }

    return (
        <div
            className="mk-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.target === event.currentTarget && !saving && onClose()}
        >

            <form className="mk-modal" onSubmit={save}>

                <div className="mk-modal-head">
                    <h2>{form.id ? m("editFormTitle") : m("productFormTitle")}</h2>
                    <button type="button" className="mk-close" onClick={onClose} disabled={saving} aria-label={m("cancel")}>
                        ✕
                    </button>
                </div>

                <div style={{ display: "grid", gap: 16 }}>

                    {/* PHOTOS */}

                    <div className="mk-field">
                        <span className="mk-field-label">📷 {m("photo")}</span>
                        <PhotoPicker items={photos} onChange={setPhotos} disabled={saving} />
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
                            {CATEGORIES.map((category) => (
                                <optgroup key={category.key} label={`${category.emoji} ${language === "fr" ? category.fr : category.en}`}>
                                    {PRODUCTS.filter((item) => item.category === category.key).map((item) => (
                                        <option key={item.key} value={item.key}>
                                            {item.emoji} {language === "fr" ? item.fr : item.en}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                            <option value="OTHER">🧺 {language === "fr" ? findProduct("OTHER").fr : findProduct("OTHER").en}</option>
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
                            <label htmlFor="pf-price">
                                {m("pricePerUnit", { unit: unitOne, currency: currencySymbol(country.currency) })}
                            </label>
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
                                        low: formatMoney(unitPrices.paid.low, country.currency),
                                        high: formatMoney(unitPrices.paid.high, country.currency),
                                        unit: unitOne,
                                        count: unitPrices.paid.count,
                                    })}
                                </div>
                            )}
                            {unitPrices.on_sale && (
                                <div>
                                    🏷️ {m("onSaleRange", {
                                        low: formatMoney(unitPrices.on_sale.low, country.currency),
                                        high: formatMoney(unitPrices.on_sale.high, country.currency),
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
                            <label htmlFor="pf-city">{m("city")} {country.flag}</label>
                            <select
                                id="pf-city"
                                className="mk-select"
                                required
                                value={form.city}
                                onChange={(event) => update("city", event.target.value)}
                            >
                                <option value="">{m("chooseCity")}</option>
                                {cityNames(country.code).map((name) => (
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
                                placeholder={language === "fr" ? "Village ou quartier" : "Village or area"}
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
                                min={form.availableFrom || todayIn(country.code)}
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
                            maxLength={600}
                            value={form.details}
                            onChange={(event) => update("details", event.target.value)}
                            placeholder={m("detailsPlaceholder")}
                        />
                    </div>

                    {status && <div className="mk-notice mk-notice-blue" role="status">{status}</div>}

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
