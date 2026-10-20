import Icon from "../Site/Icon";
import { productName } from "../../lib/produce";
import { useLanguage } from "../../lib/LanguageContext";

function coverOf(item) {
    return item?.photos?.[0]?.url || item?.photo_url || null;
}

/*
 * The product's cover photo, or a quiet tile with the
 * product's name when the farmer hasn't added one yet.
 */
export default function ProductMedia({ listing, children, eager = false }) {
    const { language } = useLanguage();

    const cover = coverOf(listing);

    return (
        <div className="mk-media">

            {cover ? (
                // Supabase serves the photo, already shrunk; next/image would add a paid optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={cover}
                    alt={productName(listing, language)}
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                />
            ) : (
                <div className="mk-media-emoji" aria-hidden="true">
                    <Icon name="image" size={34} stroke={1.4} />
                    <span>{productName(listing, language)}</span>
                </div>
            )}

            {children}

        </div>
    );
}

export function ProductThumb({ item }) {
    const cover = coverOf(item);

    return (
        <div className="mk-thumb" aria-hidden="true">
            {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" loading="lazy" decoding="async" />
            ) : (
                <Icon name="sprout" size={20} stroke={1.5} />
            )}
        </div>
    );
}
