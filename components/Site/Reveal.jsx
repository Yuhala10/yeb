import { useEffect, useRef } from "react";

/*
 * Fades its content in when it scrolls into view. Uses the
 * DOM class directly (no re-render), and shows everything
 * at once where IntersectionObserver isn't available.
 */
export default function Reveal({ as: Tag = "div", className = "", children, ...rest }) {
    const node = useRef(null);

    useEffect(() => {
        const element = node.current;

        if (!element) {
            return;
        }

        if (typeof IntersectionObserver === "undefined") {
            element.classList.add("is-visible");
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <Tag ref={node} className={`ts-reveal ${className}`} {...rest}>
            {children}
        </Tag>
    );
}
