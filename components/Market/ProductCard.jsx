import Link from "next/link";

import ProductMedia from "./ProductMedia";
import Icon from "../Site/Icon";
import { findCountry } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";
import { formatDay, useMarketText } from "../../lib/marketText";
import { formatMoney } from "../../lib/money";
import { formatAmount, productName, unitName } from "../../lib/produce";

/*
 * One listing in the market grid: the cover photo (with how
 * many photos there are), price, stock and the farmer.
 */
export default function ProductCard({ listing, showCountry = false, distanceKm = null }) {
    const { language } = useLanguage();

    const m = useMarketText();

    const farmer = listing.farmer;

    const firstName = String(farmer?.full_name || "").split(" ")[0];

    const photoCount = listing.photos?.length || 0;

    return (
        <Link href={`/market/${listing.id}`} className="mk-card">

            <ProductMedia listing={listing}>
                <div className="mk-media-badges">
                    {listing.ready_now ? (
                        <span className="mk-tag mk-tag-green"><Icon name="check" /> {m("readyNow")}</span>
                    ) : (
                        <span className="mk-tag">
                            <Icon name="calendar" /> {m("readyOn", { date: formatDay(listing.available_from, language) })}
                        </span>
                    )}

                    {listing.perishable && (
                        <span className="mk-tag mk-tag-amber"><Icon name="snowflake" /> {m("fresh")}</span>
                    )}
                </div>

                {photoCount > 1 && (
                    <span className="mk-photo-count"><Icon name="camera" /> {photoCount}</span>
                )}
            </ProductMedia>

            <div className="mk-card-body">

                <h3 className="mk-card-title">
                    {productName(listing, language)}
                </h3>

                <div className="mk-card-meta">
                    <Icon name="pin" /> {listing.area ? `${listing.area}, ` : ""}{listing.city}
                    {showCountry && findCountry(listing.country) ? ` ${findCountry(listing.country).flag}` : ""}
                    {distanceKm !== null ? ` · ~${distanceKm} km` : ""}
                </div>

                <div className="mk-price">
                    {formatMoney(listing.price_per_unit, listing.currency)}{" "}
                    <small>/ {unitName(listing.unit, language)}</small>
                </div>

                <div className="mk-card-meta">
                    {m("available", {
                        quantity: formatAmount(listing.quantity_available),
                        unit: unitName(listing.unit, language, listing.quantity_available),
                    })}
                </div>

                <div className="mk-card-foot">
                    <span><Icon name="farmer" /> {firstName}</span>

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
