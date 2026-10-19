/*
 * Line icons for posts: heart, share, bookmark. Filled when
 * active. They follow the text colour (light and dark mode).
 */

export function HeartIcon({ filled = false, size = 26 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path
                d="M12 20.6s-7.6-4.6-9.4-9.3C1.4 8 3.5 4.6 6.9 4.6c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.4 0 5.5 3.4 4.3 6.7-1.8 4.7-9.4 9.3-9.4 9.3Z"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function ShareIcon({ size = 25 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path d="M21.2 3.2 10.4 13.9M21.2 3.2l-6.9 18-3.9-7.3-7.3-3.9 18.1-6.8Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

export function BookmarkIcon({ filled = false, size = 25 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path d="M6 3.5h12v17.3l-6-4.6-6 4.6V3.5Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
    );
}

export function GridIcon({ size = 20 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

export function FeedIcon({ size = 20 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path d="M4 3.5h16v11H4zM4 18h16M4 21h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}
