/*
 * ============================================================
 * ICONS
 * ============================================================
 *
 * One set of thin line icons for the whole platform (24 × 24,
 * round ends, drawn with the text colour), so every screen
 * speaks the same calm visual language. Emojis stay for what
 * people write themselves.
 *
 *   <Icon name="truck" />            18 px, follows the text
 *   <Icon name="star" size={14} fill />
 */

const PATHS = {
    // ---------- actions ----------
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    trash: <><path d="M4.5 6.5h15M9.5 6.5v-2h5v2" /><path d="m6.5 6.5 1 13h9l1-13M10 10.5V16M14 10.5V16" /></>,
    share: <><path d="M12 14.5V3.5M7.5 8 12 3.5 16.5 8" /><path d="M5 12v7.5h14V12" /></>,
    send: <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />,
    link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
    filter: <path d="M4 6.5h16M7 12h10M10 17.5h4" />,
    logout: <path d="M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h9.5" />,
    copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" /></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
    eyeOff: <><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.5M6.5 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.3" /><path d="M9.9 9.9a2.8 2.8 0 0 0 4.2 4.2M3.5 3.5l17 17" /></>,

    // ---------- arrows ----------
    arrowRight: <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />,
    arrowLeft: <path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5" />,
    chevronRight: <path d="m9 5 7 7-7 7" />,
    chevronLeft: <path d="m15 5-7 7 7 7" />,
    chevronDown: <path d="m5 9 7 7 7-7" />,
    external: <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v5.5H4.5V6H10" />,

    // ---------- places and movement ----------
    pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
    map: <><path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5V6.5Z" /><path d="M9 4v13.5M15 6.5V20" /></>,
    navigation: <path d="M12 3 19 20l-7-4-7 4 7-17Z" />,
    locate: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.8" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
    route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></>,
    flag: <path d="M5.5 21V4M5.5 4H17l-2 4 2 4H5.5" />,
    globe: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5ZM3.5 12h17" /></>,
    home: <><path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" /><path d="M9.5 20v-5.5h5V20" /></>,
    signal: <><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.8 15.2a4.5 4.5 0 0 1 0-6.4M15.2 8.8a4.5 4.5 0 0 1 0 6.4" /><circle cx="12" cy="12" r="1.4" /></>,
    repeat: <path d="M17 3.5 20.5 7 17 10.5M20.5 7H8a4.5 4.5 0 0 0-4.5 4.5M7 20.5 3.5 17 7 13.5M3.5 17H16a4.5 4.5 0 0 0 4.5-4.5" />,

    // ---------- goods and trade ----------
    truck: <><path d="M2.5 6.5h11.5v9.5H2.5zM14 9.5h3.8l3.2 3.4V16H14" /><circle cx="7" cy="17.5" r="1.9" /><circle cx="17" cy="17.5" r="1.9" /></>,
    package: <><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    cart: <><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>,
    basket: <><path d="M3.5 9.5h17l-1.8 9.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3L3.5 9.5Z" /><path d="m8 9.5 3-5.5M16 9.5l-3-5.5M9 13v3.5M15 13v3.5" /></>,
    sprout: <><path d="M12 20.5V12" /><path d="M12 12c0-4.5-3.5-7-7.5-7 0 4.5 3 7 7.5 7ZM12 14c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5Z" /></>,
    bag: <><path d="M7 8.5h10l2 11.5H5L7 8.5Z" /><path d="M9 8.5a3 3 0 0 1 6 0" /></>,
    crate: <><rect x="3.5" y="6" width="17" height="13" rx="1.5" /><path d="M3.5 10.5h17M3.5 14.5h17M9 6v13M15 6v13" /></>,
    drum: <><path d="M6 5.5c0-1.4 2.7-2 6-2s6 .6 6 2v13c0 1.4-2.7 2-6 2s-6-.6-6-2v-13Z" /><path d="M6 5.5c0 1.4 2.7 2 6 2s6-.6 6-2M6 12c0 1.4 2.7 2 6 2s6-.6 6-2" /></>,
    bricks: <path d="M3.5 6h17v12h-17zM3.5 12h17M9 6v6M15 12v6" />,
    sofa: <path d="M5 11V8.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V11M3 11.5a1.5 1.5 0 0 1 3 0V14h12v-2.5a1.5 1.5 0 0 1 3 0V18H3v-6.5ZM5 18v2M19 18v2" />,
    paw: <><circle cx="7" cy="10" r="1.8" /><circle cx="17" cy="10" r="1.8" /><circle cx="9.8" cy="6" r="1.8" /><circle cx="14.2" cy="6" r="1.8" /><path d="M12 12c-2.8 0-5 3.2-5 5.3 0 1.6 1.4 2.2 2.6 2.2 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.2 0 2.6-.6 2.6-2.2 0-2.1-2.2-5.3-5-5.3Z" /></>,
    scale: <><path d="M8.5 8a3.5 3.5 0 1 1 7 0" /><path d="M6 8h12l2 12H4L6 8Z" /></>,
    snowflake: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />,
    tag: <><path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5L3.5 12Z" /><circle cx="8" cy="8" r="1.5" /></>,
    cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
    phoneMoney: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3M12 7.5v6M10 9.5c0-1 .9-1.5 2-1.5s2 .5 2 1.4c0 1.9-4 1.1-4 3 0 .9.9 1.4 2 1.4s2-.5 2-1.5" /></>,
    store: <><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M5.5 12v8h13v-8M10 20v-4.5h4V20" /></>,
    chart: <path d="M5 20v-9M10.5 20V5M16 20v-6M3.5 20h17" />,
    zap: <path d="M13 3 5 13.5h6L10.5 21 19 10.5h-6L13 3Z" />,

    // ---------- vehicles (side view) ----------
    moto: <><circle cx="5.5" cy="16.5" r="3" /><circle cx="18.5" cy="16.5" r="3" /><path d="M5.5 16.5 9.5 10h4.5l4.5 6.5M9.5 10 8 7.5h2.5M14 10l1.7-3H18" /></>,
    tricycle: <><path d="M11 6.5h9.5v8H11zM11 14.5H7.5L5 10.5H8" /><circle cx="5" cy="17" r="2" /><circle cx="13" cy="17" r="2" /><circle cx="19" cy="17" r="2" /></>,
    pickup: <><path d="M2.5 16v-4.5l3-4h6v4h10V16h-2M9.5 16H5" /><path d="M5.5 11.5h6" /><circle cx="7" cy="16.5" r="2" /><circle cx="17" cy="16.5" r="2" /></>,
    van: <><path d="M15 16.5H9M5 16.5H2.5V7.5a1.5 1.5 0 0 1 1.5-1.5h11l4.5 4.5 2 1v5h-2" /><path d="M14.5 6v4.5h5" /><circle cx="7" cy="16.5" r="2" /><circle cx="17" cy="16.5" r="2" /></>,

    // ---------- people and talk ----------
    user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c1.2-3.8 4.2-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></>,
    users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.9-3.2 3.3-4.7 6-4.7s5.1 1.5 6 4.7M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.9c1.8.6 3 2 3.5 4.6" /></>,
    farmer: <><circle cx="12" cy="9.5" r="3.3" /><path d="M5.5 7.5c1-2.6 3.6-4 6.5-4s5.5 1.4 6.5 4M4 7.5h16M4.5 20.5c1.2-3.6 4.2-5.3 7.5-5.3s6.3 1.7 7.5 5.3" /></>,
    phone: <path d="M6.6 3.5h2.6l1.3 4.2-1.9 1.3a11 11 0 0 0 6.4 6.4l1.3-1.9 4.2 1.3v2.6a2 2 0 0 1-2.2 2C10.6 18.9 5.1 13.4 4.6 5.7a2 2 0 0 1 2-2.2Z" />,
    chat: <path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.3-4.4A8.5 8.5 0 1 1 20.5 11.6Z" />,
    message: <><path d="M4 5.5h16v10.5H9l-5 4V5.5Z" /><path d="M8 9.5h8M8 12.5h5" /></>,
    language: <><path d="M4 5.5h16v10.5H9l-5 4V5.5Z" /><path d="m8.5 13.5 2.5-6 2.5 6M9.3 11.6h3.4" /></>,
    mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
    bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.01" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.01" /></>,
    alert: <><path d="M12 4 21 19.5H3L12 4Z" /><path d="M12 10v4.5M12 17v.01" /></>,

    // ---------- trust ----------
    shield: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3Z" /><path d="m8.8 12 2.3 2.3 4.3-4.6" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16.5 6.5 19 9M14.5 8.5l2 2" /></>,
    star: <path d="M12 3.8 14.5 9l5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9L9.5 9 12 3.8Z" />,
    badge: <><path d="M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2L12 3Z" /><path d="m8.8 12 2.3 2.3 4.3-4.6" /></>,
    idCard: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M5.5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13.5h3" /></>,

    // ---------- time ----------
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,

    // ---------- media ----------
    camera: <><path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4V8Z" /><circle cx="12" cy="13.2" r="3.3" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="M20.5 16 15.5 11 6 19.5" /></>,
    play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
    pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
    heart: <path d="M12 20.6s-7.6-4.6-9.4-9.3C1.4 8 3.5 4.6 6.9 4.6c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.4 0 5.5 3.4 4.3 6.7-1.8 4.7-9.4 9.3-9.4 9.3Z" />,
    bookmark: <path d="M6 3.5h12v17.3l-6-4.6-6 4.6V3.5Z" />,
    grid: <path d="M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z" />,
    feed: <path d="M4 3.5h16v11H4zM4 18h16M4 21h10" />,

    // ---------- app ----------
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
    dashboard: <path d="M3.5 3.5h7.5v9H3.5zM13 3.5h7.5v5H13zM13 11h7.5v9.5H13zM3.5 15H11v5.5H3.5z" />,
    sparkle: <path d="M12 3c.6 4.5 1.9 5.9 6.5 6.5-4.6.6-5.9 1.9-6.5 6.5-.6-4.6-1.9-5.9-6.5-6.5C10.1 8.9 11.4 7.5 12 3ZM18.5 15.5c.3 2 .9 2.6 2.5 2.9-1.6.3-2.2.9-2.5 2.9-.3-2-.9-2.6-2.5-2.9 1.6-.3 2.2-.9 2.5-2.9Z" />,
};

const FILLED = new Set(["play"]);

export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({ name, size = 18, stroke = 1.8, fill = false, className = "", title, style }) {
    const shape = PATHS[name];

    if (!shape) {
        return null;
    }

    const filled = fill || FILLED.has(name);

    return (
        <svg
            className={`ic ${className}`}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={title ? undefined : "true"}
            role={title ? "img" : undefined}
            style={style}
            focusable="false"
        >
            {title && <title>{title}</title>}
            {shape}
        </svg>
    );
}
