import Link from "next/link";

import ProductMedia from "./ProductMedia";
import { formatAmount, productName, unitName } from "../../lib/produce";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, useMarketText } from "../../lib/marketText";

/*
 * One listing in the market grid.
 */
export default function ProductCard({ listing }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const farmer = listing.farmer;

    const firstName = String(farmer?.full_name || "").split(" ")[0];

    return (
        <Link href={`/market/${listing.id}`} className="mk-card">

            <ProductMedia listing={listing}>
                <div className="mk-media-badges">
                    {listing.ready_now ? (
                        <span className="mk-tag mk-tag-green">✓ {m("readyNow")}</span>
                    ) : (
                        <span className="mk-tag">
                            🗓️ {m("readyOn", { date: formatDay(listing.available_from, language) })}
                        </span>
                    )}

                    {listing.perishable && (
                        <span className="mk-tag mk-tag-amber">❄️ {m("fresh")}</span>
                    )}
                </div>
            </ProductMedia>

            <div className="mk-card-body">

                <h3 className="mk-card-title">
                    {productName(listing, language)}
                </h3>

                <div className="mk-card-meta">
                    📍 {listing.area ? `${listing.area}, ` : ""}{listing.city}
                </div>

                <div className="mk-price">
                    {formatAmount(listing.price_per_unit)} FCFA{" "}
                    <small>/ {unitName(listing.unit, language)}</small>
                </div>

                <div className="mk-card-meta">
                    {m("available", {
                        quantity: formatAmount(listing.quantity_available),
                        unit: unitName(listing.unit, language, listing.quantity_available),
                    })}
                </div>

                <div className="mk-card-foot">
                    <span>👨🏾‍🌾 {firstName}</span>

                    {farmer?.rating_count ? (
                        <span className="mk-rating">
                            {m("farmerRating", { rating: farmer.rating, count: farmer.rating_count })}
                        </span>
                    ) : (
                        <span>{m("newFarmer")}</span>
                    )}
                </div>

            </div>

        </Link>
    );
}
