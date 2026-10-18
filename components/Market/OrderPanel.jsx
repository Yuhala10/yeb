import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { apiGet, apiPost } from "../../lib/api";
import { cityNames } from "../../lib/cities";
import { countryOrDefault, sortedCountries, todayIn } from "../../lib/countries";
import { currencySymbol, formatMoney } from "../../lib/money";
import { formatPhone } from "../../lib/phone";
import { useLanguage } from "../../lib/LanguageContext";
import { marketError, useMarketText } from "../../lib/marketText";
import { formatAmount, unitName } from "../../lib/produce";
import { loginThenReturn } from "../../lib/useSession";

/*
 * The order form on a listing page. Works for everyone:
 * visitors pick a quantity and are sent to log in (and back
 * here), buyers order, the farmer sees "this is yours".
 */
export default function OrderPanel({ listing, user, loading }) {
    const router = useRouter();

    const { language } = useLanguage();

    const m = useMarketText();

    const available = Number(listing.quantity_available) || 0;

    const minimum = Math.max(Number(listing.min_order) || 0, 0) || 1;

    const step = 1;

    const [quantity, setQuantity] = useState(String(Math.min(minimum, available) || 1));

    const [method, setMethod] = useState("TAYEB");

    const listingCountry = countryOrDefault(listing.country);

    const currency = listing.currency || listingCountry.currency;

    // Delivery can cross a border; the farm's country first.
    const [deliveryCountry, setDeliveryCountry] = useState(listingCountry.code);

    const [city, setCity] = useState("");

    const [area, setArea] = useState("");

    const [receiverPhone, setReceiverPhone] = useState("");

    const [budget, setBudget] = useState("");

    const [payment, setPayment] = useState("MOMO_ON_DELIVERY");

    const [neededBy, setNeededBy] = useState("");

    const [note, setNote] = useState("");

    const [routeInfo, setRouteInfo] = useState(null);

    const [sending, setSending] = useState(false);

    const [error, setError] = useState("");

    const [sent, setSent] = useState(null);

    const amount = Number(String(quantity).replace(",", ".")) || 0;

    const total = Math.round(amount * Number(listing.price_per_unit));

    const unitOne = unitName(listing.unit, language);

    const unitMany = unitName(listing.unit, language, amount);

    const isOwner = user && user.id === listing.farmer_id;

    const isBuyer = user && user.role === "SHIPPER";

    const quantityError =
        amount <= 0
            ? m("err_NOT_ENOUGH_STOCK")
            : amount < minimum
                ? m("minOrder", { quantity: formatAmount(minimum), unit: unitName(listing.unit, language, minimum) })
                : amount > available
                    ? m("err_NOT_ENOUGH_STOCK")
                    : "";

    function changeQuantity(delta) {
        const next = Math.min(available, Math.max(minimum, Math.round((amount + delta) * 100) / 100));

        setQuantity(String(next));
    }

    async function chooseCity(value) {
        setCity(value);

        setRouteInfo(null);

        if (!value || !isBuyer) {
            return;
        }

        try {
            setRouteInfo(
                await apiGet(
                    `/api/shipper?from=${encodeURIComponent(listing.city)}&to=${encodeURIComponent(value)}`
                )
            );
        } catch {
            setRouteInfo(null);
        }
    }

    function chooseMethod(value) {
        setMethod(value);

        if (value === "PICKUP" && payment === "MOMO_ON_DELIVERY") {
            setPayment("CASH_ON_PICKUP");
        }

        if (value === "TAYEB" && payment === "CASH_ON_PICKUP") {
            setPayment("MOMO_ON_DELIVERY");
        }
    }

    async function submit(event) {
        event.preventDefault();

        if (!isBuyer) {
            loginThenReturn(router, "SHIPPER", `/market/${listing.id}`);
            return;
        }

        if (quantityError || sending) {
            return;
        }

        setSending(true);
        setError("");

        try {
            const result = await apiPost("/api/market", {
                action: "order",
                productId: listing.id,
                quantity: amount,
                deliveryMethod: method,
                deliveryCountry,
                deliveryCity: city,
                deliveryArea: area,
                receiverPhone,
                deliveryBudget: budget,
                paymentTerms: payment,
                neededBy,
                note,
            });

            setSent(result);
        } catch (failure) {
            setError(marketError(language, failure));
        } finally {
            setSending(false);
        }
    }

    const paymentChoices =
        method === "PICKUP"
            ? ["CASH_ON_PICKUP", "MOMO_BEFORE_PICKUP"]
            : ["MOMO_ON_DELIVERY", "MOMO_BEFORE_PICKUP"];

    /* ------------------------------------------------------
       STATES BEFORE THE FORM
    ------------------------------------------------------ */

    if (!listing.visible) {
        return (
            <aside className="mk-panel" id="order">
                <div className="mk-notice">{m("notAvailable")}</div>
                <Link href="/market" className="mk-btn mk-btn-dark mk-btn-full">
                    {m("seeOthers")}
                </Link>
            </aside>
        );
    }

    if (sent) {
        return (
            <aside className="mk-panel tayeb-fade-in" id="order">
                <div style={{ fontSize: 44 }}>✅</div>
                <h2 style={{ margin: 0, color: "var(--mk-ink)", fontSize: 22, fontWeight: 900 }}>
                    {m("orderSent")}
                </h2>
                <p style={{ margin: 0, color: "var(--mk-muted)", lineHeight: 1.55 }}>
                    {m("orderSentText", { farmer: listing.farmer?.full_name || "" })}
                </p>
                <div className="mk-notice">{m("order", { ref: sent.ref })}</div>
                <Link href="/shipper#orders" className="mk-btn mk-btn-primary mk-btn-full mk-btn-lg">
                    {m("seeMyOrders")} →
                </Link>
                <Link href="/market" className="mk-btn mk-btn-light mk-btn-full">
                    {m("seeOthers")}
                </Link>
            </aside>
        );
    }

    if (isOwner) {
        return (
            <aside className="mk-panel" id="order">
                <div className="mk-notice mk-notice-green">👨🏾‍🌾 {m("yourProduct")}</div>
                <Link href="/farmer" className="mk-btn mk-btn-dark mk-btn-full">
                    {m("manage")}
                </Link>
            </aside>
        );
    }

    /* ------------------------------------------------------
       THE FORM
    ------------------------------------------------------ */

    return (
        <form className="mk-panel" id="order" onSubmit={submit}>

            <div className="mk-panel-price">
                <div className="mk-price" style={{ fontSize: 26 }}>
                    {formatMoney(listing.price_per_unit, currency)} <small>/ {unitOne}</small>
                </div>
                <span className="mk-pill mk-pill-green">
                    {formatAmount(available)} {unitName(listing.unit, language, available)}
                </span>
            </div>

            {user && !isBuyer && (
                <div className="mk-notice">{m("buyerOnly")}</div>
            )}


            {/* QUANTITY */}

            <div className="mk-field">
                <label htmlFor="order-quantity">{m("quantity")} ({unitMany})</label>

                <div className="mk-stepper">
                    <button
                        type="button"
                        aria-label="−"
                        disabled={amount <= minimum}
                        onClick={() => changeQuantity(-step)}
                    >
                        −
                    </button>

                    <input
                        id="order-quantity"
                        inputMode="decimal"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value.replace(/[^\d.,]/g, "").slice(0, 9))}
                    />

                    <button
                        type="button"
                        aria-label="+"
                        disabled={amount >= available}
                        onClick={() => changeQuantity(step)}
                    >
                        +
                    </button>
                </div>

                {Number(listing.min_order) > 1 && (
                    <small>
                        {m("minOrder", {
                            quantity: formatAmount(listing.min_order),
                            unit: unitName(listing.unit, language, listing.min_order),
                        })}
                    </small>
                )}

                {quantityError && amount > 0 && <small style={{ color: "var(--tint-red-fg)" }}>{quantityError}</small>}
            </div>

            <div className="mk-total">
                <span>
                    {m("orderSummary", {
                        quantity: formatAmount(amount),
                        unit: unitMany,
                        price: formatMoney(listing.price_per_unit, currency),
                    })}
                </span>
                <strong>{formatMoney(total, currency)}</strong>
            </div>


            {isBuyer && (
                <>
                    {/* DELIVERY */}

                    <div className="mk-field">
                        <span className="mk-field-label">{m("delivery")}</span>

                        <div className="mk-options">
                            {[
                                ["TAYEB", "🚚", "deliveryTayeb", "deliveryTayebText"],
                                ["PICKUP", "🧺", "deliveryPickup", "deliveryPickupText"],
                            ].map(([value, icon, title, text]) => (
                                <label key={value} className={`mk-option ${method === value ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="delivery-method"
                                        checked={method === value}
                                        onChange={() => chooseMethod(value)}
                                    />
                                    <div>
                                        <strong>{icon} {m(title)}</strong>
                                        <span>{m(text)}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {method === "TAYEB" && (
                        <>
                            <div className="mk-field">
                                <label htmlFor="order-city">{m("deliverTo")}</label>

                                <select
                                    className="mk-select"
                                    value={deliveryCountry}
                                    aria-label={language === "fr" ? "Pays de livraison" : "Delivery country"}
                                    onChange={(event) => {
                                        setDeliveryCountry(event.target.value);
                                        setCity("");
                                        setRouteInfo(null);
                                    }}
                                >
                                    {sortedCountries(language).map((item) => (
                                        <option key={item.code} value={item.code}>
                                            {item.flag} {language === "fr" ? item.fr : item.en}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    id="order-city"
                                    className="mk-select"
                                    value={city}
                                    required
                                    onChange={(event) => chooseCity(event.target.value)}
                                >
                                    <option value="">{m("chooseCity")}</option>
                                    {cityNames(deliveryCountry).map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>

                                <input
                                    className="mk-input"
                                    value={area}
                                    maxLength={80}
                                    onChange={(event) => setArea(event.target.value)}
                                    placeholder={m("areaPlaceholder")}
                                />
                            </div>

                            <div className="mk-row">
                                <div className="mk-field">
                                    <label htmlFor="order-budget">{m("budget", { currency: currencySymbol(currency) })}</label>
                                    <input
                                        id="order-budget"
                                        className="mk-input"
                                        inputMode="numeric"
                                        required
                                        value={budget}
                                        onChange={(event) => setBudget(event.target.value.replace(/[^\d]/g, "").slice(0, 9))}
                                        placeholder="25000"
                                    />
                                </div>

                                <div className="mk-field">
                                    <label htmlFor="order-receiver">{m("receiverPhone")}</label>
                                    <input
                                        id="order-receiver"
                                        className="mk-input"
                                        inputMode="tel"
                                        value={receiverPhone}
                                        onChange={(event) => setReceiverPhone(event.target.value)}
                                        placeholder={formatPhone(user.phone_number) || "+237 6XX XXX XXX"}
                                    />
                                </div>
                            </div>

                            <small style={{ color: "var(--mk-muted)", marginTop: -8 }}>
                                {m("budgetHint")}
                                {routeInfo?.route_km > 0 && ` · ${m("tripKm", { km: routeInfo.route_km })}`}
                                {routeInfo?.hint && (
                                    <>
                                        {" · "}
                                        <strong style={{ color: "var(--ts-orange-deep)" }}>
                                            {m("budgetUsual", {
                                                low: formatMoney(routeInfo.hint.low, currency),
                                                high: formatMoney(routeInfo.hint.high, currency),
                                                count: routeInfo.hint.count,
                                            })}
                                        </strong>
                                    </>
                                )}
                            </small>
                        </>
                    )}


                    {/* PAYMENT */}

                    <div className="mk-field">
                        <span className="mk-field-label">{m("payment")}</span>

                        <div className="mk-options">
                            {paymentChoices.map((value) => (
                                <label key={value} className={`mk-option ${payment === value ? "selected" : ""}`}>
                                    <input
                                        type="radio"
                                        name="payment-terms"
                                        checked={payment === value}
                                        onChange={() => setPayment(value)}
                                    />
                                    <strong>{m(value)}</strong>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mk-row">
                        <div className="mk-field">
                            <label htmlFor="order-needed">{m("neededBy")}</label>
                            <input
                                id="order-needed"
                                type="date"
                                className="mk-input"
                                min={todayIn(listingCountry.code)}
                                value={neededBy}
                                onChange={(event) => setNeededBy(event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mk-field">
                        <label htmlFor="order-note">{m("note")}</label>
                        <textarea
                            id="order-note"
                            className="mk-textarea"
                            maxLength={300}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={m("notePlaceholder")}
                        />
                    </div>

                    {listing.perishable && method === "TAYEB" && (
                        <div className="mk-notice">❄️ {m("freshWarning")}</div>
                    )}
                </>
            )}

            {error && <div className="mk-notice mk-notice-red" role="alert">{error}</div>}

            <button
                type="submit"
                className="mk-btn mk-btn-primary mk-btn-full mk-btn-lg"
                disabled={loading || sending || (isBuyer && Boolean(quantityError)) || (user && !isBuyer)}
            >
                {sending ? (
                    <span className="tayeb-spinner" />
                ) : isBuyer ? (
                    <>🛒 {m("placeOrder")} · {formatMoney(total, currency)}</>
                ) : (
                    <>{m("loginToOrder")} →</>
                )}
            </button>

        </form>
    );
}
