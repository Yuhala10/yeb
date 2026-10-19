import { useEffect, useMemo, useState } from "react";

/*
 * The visible part of the map: above the sheet on phones,
 * right of the panel on computers.
 */
export function useMapPadding(element) {
    const [size, setSize] = useState({ width: 0, height: 0, desktop: false });

    useEffect(() => {
        if (!element || typeof ResizeObserver === "undefined") {
            return;
        }

        const measure = () =>
            setSize({
                width: element.offsetWidth,
                height: element.offsetHeight,
                desktop: window.innerWidth > 900,
            });

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        window.addEventListener("resize", measure);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [element]);

    return useMemo(
        () =>
            size.desktop
                ? { top: 84, right: 24, bottom: 24, left: size.width + 36 }
                : { top: 78, right: 14, bottom: size.height + 10, left: 14 },
        [size]
    );
}
