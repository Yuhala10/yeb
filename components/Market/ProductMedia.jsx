import { productEmoji, productName } from "../../lib/produce";
import { useLanguage } from "../../lib/LanguageContext";

/*
 * The product photo, or a soft gradient with the product's
 * emoji when the farmer hasn't added one yet.
 */
export default function ProductMedia({ listing, children, eager = false }) {
    const { language } = useLanguage();

    return (
        <div className="mk-media">

            {listing.photo_url ? (
                // Supabase serves the photo; next/image would add a paid optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={listing.photo_url}
                    alt={productName(listing, language)}
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                />
            ) : (
                <div className="mk-media-emoji" aria-hidden="true">
                    {productEmoji(listing.product)}
                </div>
            )}

            {children}

        </div>
    );
}

export function ProductThumb({ item }) {
    return (
        <div className="mk-thumb" aria-hidden="true">
            {item?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo_url} alt="" loading="lazy" decoding="async" />
            ) : (
                productEmoji(item?.product)
            )}
        </div>
    );
}
