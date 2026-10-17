/*
 * ============================================================
 * MONEY
 * ============================================================
 *
 * Prices are whole amounts in the country's currency. Shown
 * the way people write them locally:
 * 25,000 FCFA · ₦25,000 · GH₵250 · KSh 2,500.
 */

const CURRENCIES = {
    XAF: { symbol: "FCFA", after: true },
    XOF: { symbol: "FCFA", after: true },
    NGN: { symbol: "₦", after: false, space: false },
    GHS: { symbol: "GH₵", after: false, space: false },
    KES: { symbol: "KSh", after: false, space: true },
    CDF: { symbol: "FC", after: true },
    GNF: { symbol: "FG", after: true },
    RWF: { symbol: "RWF", after: false, space: true },
    UGX: { symbol: "USh", after: false, space: true },
    TZS: { symbol: "TSh", after: false, space: true },
};

export const DEFAULT_CURRENCY = "XAF";

export function currencySymbol(code) {
    return (CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY]).symbol;
}

export function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-US", {
        maximumFractionDigits: 2,
    });
}

/*
 * formatMoney(25000, "XAF") → "25,000 FCFA"
 * formatMoney(25000, "NGN") → "₦25,000"
 */
export function formatMoney(value, code = DEFAULT_CURRENCY) {
    const currency = CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];

    const amount = formatNumber(Math.round(Number(value) || 0));

    if (currency.after) {
        return `${amount} ${currency.symbol}`;
    }

    return `${currency.symbol}${currency.space ? " " : ""}${amount}`;
}
