import { useRef, useState } from "react";

/*
 * Swipeable photos (like a social post): swipe on phones,
 * arrows on computers, dots and thumbnails to jump. No
 * library: CSS scroll-snap does the motion.
 */
export default function PhotoCarousel({ photos = [], alt = "", emoji = "🧺", children }) {
    const track = useRef(null);

    const [index, setIndex] = useState(0);

    const count = photos.length;

    function go(next) {
        const element = track.current;

        if (!element || count === 0) {
            return;
        }

        const target = Math.max(0, Math.min(count - 1, next));

        element.scrollTo({ left: target * element.clientWidth, behavior: "smooth" });

        setIndex(target);
    }

    function onScroll() {
        const element = track.current;

        if (!element || element.clientWidth === 0) {
            return;
        }

        const current = Math.round(element.scrollLeft / element.clientWidth);

        if (current !== index) {
            setIndex(current);
        }
    }

    function onKey(event) {
        if (event.key === "ArrowRight") {
            go(index + 1);
        } else if (event.key === "ArrowLeft") {
            go(index - 1);
        }
    }

    return (
        <div>
            <div className="ts-carousel">

                <div
                    ref={track}
                    className="ts-carousel-track"
                    onScroll={onScroll}
                    onKeyDown={onKey}
                    tabIndex={count > 1 ? 0 : -1}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label={alt}
                >
                    {count === 0 ? (
                        <div className="ts-carousel-slide">
                            <div className="ts-carousel-empty" aria-hidden="true">{emoji}</div>
                        </div>
                    ) : (
                        photos.map((photo, position) => (
                            <div
                                key={photo.url}
                                className="ts-carousel-slide"
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${position + 1} / ${count}`}
                            >
                                {/* Photos come from Supabase storage, already compressed. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo.url}
                                    alt={`${alt} — ${position + 1}`}
                                    loading={position === 0 ? "eager" : "lazy"}
                                    decoding="async"
                                    draggable={false}
                                />
                            </div>
                        ))
                    )}
                </div>

                {children}

                {count > 1 && (
                    <>
                        <button type="button" className="ts-carousel-arrow prev" onClick={() => go(index - 1)} aria-label="←" disabled={index === 0} style={{ opacity: index === 0 ? 0.4 : 1 }}>
                            ‹
                        </button>
                        <button type="button" className="ts-carousel-arrow next" onClick={() => go(index + 1)} aria-label="→" disabled={index === count - 1} style={{ opacity: index === count - 1 ? 0.4 : 1 }}>
                            ›
                        </button>
                        <span className="ts-carousel-count">{index + 1}/{count}</span>
                        <div className="ts-carousel-dots">
                            {photos.map((photo, position) => (
                                <button
                                    key={photo.url}
                                    type="button"
                                    className={position === index ? "active" : ""}
                                    onClick={() => go(position)}
                                    aria-label={`${position + 1}`}
                                />
                            ))}
                        </div>
                    </>
                )}

            </div>

            {count > 1 && (
                <div className="ts-thumbs">
                    {photos.map((photo, position) => (
                        <button
                            key={photo.url}
                            type="button"
                            className={position === index ? "active" : ""}
                            onClick={() => go(position)}
                            aria-label={`${position + 1}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt="" loading="lazy" decoding="async" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
