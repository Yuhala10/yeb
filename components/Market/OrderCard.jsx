import { useState } from "react";

import { ProductThumb } from "./ProductMedia";
import { formatAmount, productName, unitName } from "../../lib/produce";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, useMarketText } from "../../lib/marketText";

const PILL = {
    PENDING: "mk-pill-orange",
    CONFIRMED: "mk-pill-blue",
    COMPLETED: "mk-pill-green",
    DECLINED: "mk-pill-red",
    CANCELLED: "mk-pill-red",
    EXPIRED: "",
};

const DECLINE_REASONS = ["SOLD_OUT", "PRICE", "QUANTITY", "DATE", "OTHER"];

function phoneLink(phone) {
    return `tel:+237${phone}`;
}

/*
 * One produce order, for the farmer (role="farmer") or the
 * buyer (role="buyer"). onAction(action, order, extra) runs
 * the change; busy disables the buttons while it runs.
 */
export default function OrderCard({ order, role, onAction, busy }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const [declining, setDeclining] = useState(false);

    const [reason, setReason] = useState("SOLD_OUT");

    const [message, setMessage] = useState("");

    const isFarmer = role === "farmer";

    const other = isFarmer ? order.buyer : order.farmer;

    const delivery = order.delivery;

    const unitLabel = unitName(order.unit, language, order.quantity);

    const title = `${formatAmount(order.quantity)} ${unitLabel} · ${productName(order, language)}`;

    const statusLabel =
        isFarmer && order.status === "PENDING"
            ? m("farmerStatus_PENDING")
            : m(`orderStatus_${order.status}`);

    const live = order.status === "CONFIRMED" || order.status === "COMPLETED";

    // Ordered → confirmed → on the road → done
    const onRoad =
        order.status === "COMPLETED" ||
        ["DEPARTED", "ARRIVED", "COMPLETED"].includes(delivery?.status);

    const steps = [
        true,
        live,
        onRoad || (order.delivery_method === "PICKUP" && order.status === "COMPLETED"),
        order.status === "COMPLETED",
    ];

    const nowStep = steps.lastIndexOf(true) + 1;

    function deliveryText() {
        if (!delivery) {
            return null;
        }

        const driver = delivery.driver_name || "";

        switch (delivery.status) {
            case "OPEN":
                return isFarmer ? m("delivery_finding") : m("buyerDelivery_finding");
            case "MATCHED":
                return m("delivery_matched", { driver });
            case "DEPARTED":
                return m("delivery_departed", { driver });
            case "ARRIVED":
                return m("delivery_arrived");
            case "COMPLETED":
                return m("delivery_completed");
            case "CANCELLED":
                return m("delivery_cancelled");
            default:
                return null;
        }
    }

    const canCancel =
        !isFarmer &&
        (order.status === "PENDING" ||
            (order.status === "CONFIRMED" &&
                (order.delivery_method === "PICKUP" || !delivery || delivery.status === "OPEN")));

    return (
        <article className="mk-order">

            <div className="mk-order-head">

                <div className="mk-order-title">

                    <ProductThumb item={order} />

                    <div style={{ minWidth: 0 }}>
                        <strong>{title}</strong>
                        <span>
                            {m("order", { ref: order.ref })} · {m("orderedOn", { date: formatDay(order.created_at, language) })}
                        </span>
                    </div>

                </div>

                <span className={`mk-pill ${PILL[order.status] || ""}`}>
                    {statusLabel}
                </span>

            </div>


            {/* PROGRESS */}

            {(order.status === "PENDING" || live) && (
                <div className="mk-progress" aria-hidden="true">
                    {steps.map((done, index) => (
                        <span
                            key={index}
                            className={done ? "done" : index === nowStep ? "now" : ""}
                        />
                    ))}
                </div>
            )}


            {/* DETAILS */}

            <div className="mk-kv">

                <div>
                    <small>{m("total")}</small>
                    <strong>{formatAmount(order.total_price)} FCFA</strong>
                </div>

                <div>
                    <small>{m("perUnit", { unit: unitName(order.unit, language) })}</small>
                    <strong>{formatAmount(order.price_per_unit)} FCFA</strong>
                </div>

                <div>
                    <small>{m("deliverToLabel")}</small>
                    <strong>
                        {order.delivery_method === "PICKUP"
                            ? m("collectByBuyer")
                            : `${order.delivery_area ? `${order.delivery_area}, ` : ""}${order.delivery_city}`}
                    </strong>
                </div>

                <div>
                    <small>{m("paymentLabel")}</small>
                    <strong>
                        {m(order.payment_terms)}
                        {live ? ` · ${order.paid_at ? m("paid") : m("unpaid")}` : ""}
                    </strong>
                </div>

                {order.weight_kg > 0 && (
                    <div>
                        <small>{m("weightLabel")}</small>
                        <strong>~{formatAmount(order.weight_kg)} kg</strong>
                    </div>
                )}

                {order.delivery_budget > 0 && (
                    <div>
                        <small>{m("budgetLabel")}</small>
                        <strong>{formatAmount(order.delivery_budget)} FCFA</strong>
                    </div>
                )}

                {order.needed_by && (
                    <div>
                        <small>{m("neededByLabel")}</small>
                        <strong>{formatDay(order.needed_by, language)}</strong>
                    </div>
                )}

                {other && (
                    <div>
                        <small>{isFarmer ? m("buyer") : m("farmer")}</small>
                        <strong>
                            {other.full_name}
                            {other.phone_number ? (
                                <>
                                    {" · "}
                                    <a href={phoneLink(other.phone_number)}>{other.phone_number}</a>
                                </>
                            ) : null}
                        </strong>
                    </div>
                )}

            </div>

            {order.note && (
                <div className="mk-notice">
                    💬 {order.note}
                </div>
            )}


            {/* WHAT'S HAPPENING */}

            {isFarmer && order.status === "PENDING" && order.hours_left !== null && (
                <div className="mk-notice">
                    ⏳ {m("expiresIn", { hours: order.hours_left })}
                </div>
            )}

            {order.status === "DECLINED" && (
                <div className="mk-notice mk-notice-red">
                    {m("declinedBecause", { reason: m(`reason_${order.decline_reason || "OTHER"}`) })}
                    {order.decline_message ? ` · “${order.decline_message}”` : ""}
                </div>
            )}

            {deliveryText() && order.status !== "CANCELLED" && (
                <div className="mk-notice mk-notice-blue">
                    🚚 {deliveryText()}
                    {delivery?.driver_phone && (
                        <>
                            {" · "}
                            <a href={phoneLink(delivery.driver_phone)}>{delivery.driver_phone}</a>
                        </>
                    )}
                </div>
            )}

            {!isFarmer && live && !order.paid_at && other?.phone_number && (
                <div className="mk-notice mk-notice-green">
                    💵 {m("payFarmer", {
                        farmer: other.full_name,
                        amount: formatAmount(order.total_price),
                        phone: other.phone_number,
                    })}
                </div>
            )}


            {/* FARMER: DECLINE FORM */}

            {declining && (
                <div className="mk-field" style={{ gap: 10 }}>

                    <span className="mk-field-label">{m("declineReason")}</span>

                    <div className="mk-options">
                        {DECLINE_REASONS.map((code) => (
                            <label key={code} className={`mk-option ${reason === code ? "selected" : ""}`}>
                                <input
                                    type="radio"
                                    name={`reason-${order.id}`}
                                    checked={reason === code}
                                    onChange={() => setReason(code)}
                                />
                                <strong>{m(`reason_${code}`)}</strong>
                            </label>
                        ))}
                    </div>

                    <input
                        className="mk-input"
                        value={message}
                        maxLength={200}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={m("declineMessage")}
                    />

                    <div className="mk-actions">
                        <button
                            type="button"
                            className="mk-btn mk-btn-dark"
                            disabled={busy}
                            onClick={() => onAction("decline", order, { reason, message })}
                        >
                            {m("sendDecline")}
                        </button>
                        <button
                            type="button"
                            className="mk-btn mk-btn-light"
                            onClick={() => setDeclining(false)}
                        >
                            {m("cancel")}
                        </button>
                    </div>

                </div>
            )}


            {/* ACTIONS */}

            <div className="mk-actions">

                {isFarmer && order.status === "PENDING" && !declining && (
                    <>
                        <button
                            type="button"
                            className="mk-btn mk-btn-green"
                            disabled={busy}
                            onClick={() => onAction("confirm", order)}
                        >
                            ✓ {m("confirm")}
                        </button>
                        <button
                            type="button"
                            className="mk-btn mk-btn-light"
                            disabled={busy}
                            onClick={() => setDeclining(true)}
                        >
                            {m("decline")}
                        </button>
                    </>
                )}

                {isFarmer && live && !order.paid_at && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-green"
                        disabled={busy}
                        onClick={() => onAction("paid", order)}
                    >
                        💵 {m("markPaid")}
                    </button>
                )}

                {!isFarmer && order.status === "CONFIRMED" && order.delivery_method === "PICKUP" && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-green"
                        disabled={busy}
                        onClick={() => onAction("received", order)}
                    >
                        ✓ {m("received")}
                    </button>
                )}

                {other?.phone_number && live && (
                    <a className="mk-btn mk-btn-light" href={phoneLink(other.phone_number)}>
                        📞 {isFarmer ? m("callBuyer") : m("callFarmer")}
                    </a>
                )}

                {delivery?.driver_phone && live && (
                    <a className="mk-btn mk-btn-light" href={phoneLink(delivery.driver_phone)}>
                        🚚 {m("callDriver")}
                    </a>
                )}

                {canCancel && (
                    <button
                        type="button"
                        className="mk-btn mk-btn-ghost"
                        disabled={busy}
                        onClick={() => onAction("cancel", order)}
                    >
                        {m("cancelOrder")}
                    </button>
                )}

            </div>


            {/* BUYER: RATE THE FARMER */}

            {!isFarmer && order.status === "COMPLETED" && (
                order.farmer_rating ? (
                    <div className="mk-rating">
                        {"★".repeat(order.farmer_rating)}{"☆".repeat(5 - order.farmer_rating)} {m("yourRating")}
                    </div>
                ) : (
                    <div className="mk-stars">
                        <span className="mk-field-label">{m("rateFarmer")}</span>
                        {[1, 2, 3, 4, 5].map((stars) => (
                            <button
                                key={stars}
                                type="button"
                                disabled={busy}
                                aria-label={`${stars} / 5`}
                                onClick={() => onAction("rate", order, { rating: stars })}
                            >
                                {stars} ★
                            </button>
                        ))}
                    </div>
                )
            )}

        </article>
    );
}
