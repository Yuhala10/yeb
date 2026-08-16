import { useEffect, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";
import { useLanguage } from "../lib/LanguageContext";

export default function Notifications({
    userId,
}) {
    const { language } = useLanguage();

    const [notifications, setNotifications] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [open, setOpen] =
        useState(false);

    const [audioReady, setAudioReady] =
        useState(false);

    const audioRef =
        useRef(null);

    const initializedRef =
        useRef(false);

    const previousIdsRef =
        useRef(new Set());

    /* =========================================================
       LANGUAGE
    ========================================================= */

    const isFrench =
        language === "fr";

    const text = {
        title: isFrench
            ? "Notifications"
            : "Notifications",

        noNotifications: isFrench
            ? "Aucune notification pour le moment."
            : "No notifications yet.",

        loading: isFrench
            ? "Chargement..."
            : "Loading...",

        markRead: isFrench
            ? "Marquer comme lu"
            : "Mark as read",

        markAllRead: isFrench
            ? "Tout marquer comme lu"
            : "Mark all as read",

        newNotification: isFrench
            ? "Nouvelle notification"
            : "New notification",

        close: isFrench
            ? "Fermer"
            : "Close",
    };


    /* =========================================================
       CREATE AUDIO
    ========================================================= */

    useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const audio =
            new Audio(
                "/sounds/notification.mp3"
            );

        audio.preload = "auto";

        audioRef.current =
            audio;

        /*
         * Browsers may block sound until
         * the user interacts with the app.
         *
         * We prepare the audio here.
         */

        const unlockAudio =
            () => {
                if (
                    !audioRef.current
                ) {
                    return;
                }

                audioRef.current
                    .play()
                    .then(() => {
                        audioRef.current.pause();

                        audioRef.current.currentTime =
                            0;

                        setAudioReady(
                            true
                        );
                    })
                    .catch(() => {
                        /*
                         * Browser still has
                         * audio locked.
                         *
                         * That's okay.
                         */
                    });
            };

        window.addEventListener(
            "click",
            unlockAudio,
            {
                once: true,
            }
        );

        window.addEventListener(
            "touchstart",
            unlockAudio,
            {
                once: true,
            }
        );

        window.addEventListener(
            "keydown",
            unlockAudio,
            {
                once: true,
            }
        );

        return () => {
            window.removeEventListener(
                "click",
                unlockAudio
            );

            window.removeEventListener(
                "touchstart",
                unlockAudio
            );

            window.removeEventListener(
                "keydown",
                unlockAudio
            );

            if (
                audioRef.current
            ) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);


    /* =========================================================
       FETCH NOTIFICATIONS
    ========================================================= */

    useEffect(() => {
        if (!userId) {
            return;
        }

        fetchNotifications();

        /*
         * Realtime notification channel.
         */

        const channel =
            supabase
                .channel(
                    `tayeb-notifications-${userId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "notifications",
                        filter:
                            `user_id=eq.${userId}`,
                    },
                    async (
                        payload
                    ) => {
                        const newNotification =
                            payload.new;

                        /*
                         * Add the notification
                         * immediately.
                         */

                        setNotifications(
                            (
                                current
                            ) => {
                                const exists =
                                    current.some(
                                        (
                                            item
                                        ) =>
                                            item.id ===
                                            newNotification.id
                                    );

                                if (
                                    exists
                                ) {
                                    return current;
                                }

                                return [
                                    newNotification,
                                    ...current,
                                ];
                            }
                        );

                        /*
                         * Play the sound.
                         */

                        await playNotificationSound();

                        /*
                         * Refresh from database
                         * to keep everything in sync.
                         */

                        fetchNotifications();
                    }
                )
                .subscribe();

        return () => {
            supabase.removeChannel(
                channel
            );
        };
    }, [userId]);


    /* =========================================================
       FETCH
    ========================================================= */

    async function fetchNotifications() {
        if (!userId) {
            return;
        }

        setLoading(true);

        try {
            const {
                data,
                error,
            } = await supabase
                .from("notifications")
                .select("*")
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                );

            if (error) {
                console.error(
                    "Notifications fetch error:",
                    error
                );

                return;
            }

            const safeData =
                data || [];

            /*
             * On the first load we do NOT
             * play sound.
             *
             * Otherwise every page refresh
             * could make the notification sound.
             */

            if (
                !initializedRef.current
            ) {
                previousIdsRef.current =
                    new Set(
                        safeData.map(
                            (
                                item
                            ) =>
                                item.id
                        )
                    );

                initializedRef.current =
                    true;
            }

            setNotifications(
                safeData
            );
        } catch (error) {
            console.error(
                "Notification error:",
                error
            );
        } finally {
            setLoading(false);
        }
    }


    /* =========================================================
       PLAY SOUND
    ========================================================= */

    async function playNotificationSound() {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        if (
            !audioRef.current
        ) {
            audioRef.current =
                new Audio(
                    "/sounds/notification.mp3"
                );

            audioRef.current.preload =
                "auto";
        }

        const audio =
            audioRef.current;

        try {
            audio.currentTime =
                0;

            audio.volume =
                0.85;

            await audio.play();

            setAudioReady(
                true
            );
        } catch (error) {
            /*
             * The browser may block
             * sound until the user has
             * interacted with the app.
             *
             * We don't break the
             * notification system if
             * that happens.
             */

            console.log(
                "Notification sound waiting for user interaction."
            );
        }
    }


    /* =========================================================
       MARK ONE READ
    ========================================================= */

    async function markRead(
        notificationId
    ) {
        if (
            !notificationId
        ) {
            return;
        }

        try {
            const {
                error,
            } = await supabase
                .from("notifications")
                .update({
                    read: true,
                })
                .eq(
                    "id",
                    notificationId
                )
                .eq(
                    "user_id",
                    userId
                );

            if (error) {
                throw error;
            }

            setNotifications(
                (
                    current
                ) =>
                    current.map(
                        (
                            item
                        ) =>
                            item.id ===
                                notificationId
                                ? {
                                    ...item,
                                    read: true,
                                }
                                : item
                    )
            );
        } catch (error) {
            console.error(
                "Mark notification read error:",
                error
            );
        }
    }


    /* =========================================================
       MARK ALL READ
    ========================================================= */

    async function markAllRead() {
        if (!userId) {
            return;
        }

        const unread =
            notifications.filter(
                (
                    item
                ) =>
                    !item.read
            );

        if (
            unread.length ===
            0
        ) {
            return;
        }

        try {
            const {
                error,
            } = await supabase
                .from("notifications")
                .update({
                    read: true,
                })
                .eq(
                    "user_id",
                    userId
                )
                .eq(
                    "read",
                    false
                );

            if (error) {
                throw error;
            }

            setNotifications(
                (
                    current
                ) =>
                    current.map(
                        (
                            item
                        ) => ({
                            ...item,
                            read: true,
                        })
                    )
            );
        } catch (error) {
            console.error(
                "Mark all notifications read error:",
                error
            );
        }
    }


    /* =========================================================
       TOGGLE
    ========================================================= */

    function toggleNotifications() {
        setOpen(
            (
                current
            ) => !current
        );
    }


    /* =========================================================
       COUNTS
    ========================================================= */

    const unreadCount =
        notifications.filter(
            (
                item
            ) =>
                !item.read
        ).length;


    /* =========================================================
       TIME
    ========================================================= */

    function formatTime(
        value
    ) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleString(
            isFrench
                ? "fr-FR"
                : "en-US",
            {
                dateStyle:
                    "short",
                timeStyle:
                    "short",
            }
        );
    }


    /* =========================================================
       RENDER
    ========================================================= */

    if (!userId) {
        return null;
    }


    return (
        <div
            className="tayeb-notification-wrapper"
        >

            {/* =================================================
                BELL
            ================================================= */}

            <button
                type="button"
                className="tayeb-notification-button"
                onClick={
                    toggleNotifications
                }
                aria-label={
                    text.title
                }
                aria-expanded={
                    open
                }
            >

                <span
                    style={{
                        fontSize:
                            "18px",
                        lineHeight:
                            1,
                    }}
                >
                    🔔
                </span>


                {unreadCount >
                    0 && (
                        <span className="tayeb-notification-dot">
                            {unreadCount >
                                99
                                ? "99+"
                                : unreadCount}
                        </span>
                    )}

            </button>


            {/* =================================================
                PANEL
            ================================================= */}

            {open && (
                <>

                    {/* MOBILE BACKDROP */}

                    <div
                        onClick={() =>
                            setOpen(
                                false
                            )
                        }
                        style={{
                            position:
                                "fixed",
                            inset:
                                0,
                            zIndex:
                                998,
                            background:
                                "rgba(17,24,39,0.20)",
                        }}
                    />


                    <div
                        className="tayeb-notification-panel"
                        style={{
                            position:
                                "absolute",
                            top:
                                "calc(100% + 10px)",
                            right:
                                0,
                            zIndex:
                                999,
                            width:
                                "min(390px, calc(100vw - 24px))",
                            maxHeight:
                                "min(600px, calc(100vh - 95px))",
                            overflow:
                                "hidden",
                            background:
                                "white",
                            border:
                                "1px solid #e5e7eb",
                            borderRadius:
                                "22px",
                            boxShadow:
                                "0 25px 70px rgba(17,24,39,0.18)",
                        }}
                    >

                        {/* =================================================
                            PANEL HEADER
                        ================================================= */}

                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "space-between",
                                gap:
                                    "10px",
                                padding:
                                    "16px",
                                borderBottom:
                                    "1px solid #f1f5f9",
                            }}
                        >

                            <div>

                                <div
                                    style={{
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        gap:
                                            "7px",
                                    }}
                                >

                                    <span
                                        style={{
                                            color:
                                                "#f97316",
                                            fontSize:
                                                "16px",
                                        }}
                                    >
                                        🔔
                                    </span>

                                    <strong
                                        style={{
                                            color:
                                                "#111827",
                                            fontSize:
                                                "14px",
                                            fontWeight:
                                                900,
                                        }}
                                    >
                                        {
                                            text.title
                                        }
                                    </strong>

                                    {unreadCount >
                                        0 && (
                                            <span
                                                style={{
                                                    minWidth:
                                                        "20px",
                                                    height:
                                                        "20px",
                                                    padding:
                                                        "0 5px",
                                                    display:
                                                        "inline-flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "center",
                                                    borderRadius:
                                                        "999px",
                                                    background:
                                                        "#f97316",
                                                    color:
                                                        "white",
                                                    fontSize:
                                                        "8px",
                                                    fontWeight:
                                                        900,
                                                }}
                                            >
                                                {
                                                    unreadCount
                                                }
                                            </span>
                                        )}

                                </div>

                            </div>


                            {unreadCount >
                                0 && (
                                    <button
                                        type="button"
                                        onClick={
                                            markAllRead
                                        }
                                        style={{
                                            border:
                                                "0",
                                            background:
                                                "transparent",
                                            color:
                                                "#ea580c",
                                            fontSize:
                                                "9px",
                                            fontWeight:
                                                800,
                                            cursor:
                                                "pointer",
                                        }}
                                    >
                                        {
                                            text.markAllRead
                                        }
                                    </button>
                                )}

                        </div>


                        {/* =================================================
                            CONTENT
                        ================================================= */}

                        <div
                            style={{
                                maxHeight:
                                    "510px",
                                overflowY:
                                    "auto",
                                padding:
                                    "10px",
                            }}
                        >

                            {loading ? (
                                <div
                                    style={{
                                        minHeight:
                                            "130px",
                                        display:
                                            "grid",
                                        placeItems:
                                            "center",
                                        color:
                                            "#9ca3af",
                                        fontSize:
                                            "10px",
                                    }}
                                >
                                    {
                                        text.loading
                                    }
                                </div>
                            ) : notifications.length ===
                                0 ? (
                                <div
                                    style={{
                                        minHeight:
                                            "190px",
                                        display:
                                            "flex",
                                        flexDirection:
                                            "column",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                        textAlign:
                                            "center",
                                        padding:
                                            "20px",
                                    }}
                                >

                                    <div
                                        style={{
                                            width:
                                                "55px",
                                            height:
                                                "55px",
                                            display:
                                                "grid",
                                            placeItems:
                                                "center",
                                            borderRadius:
                                                "18px",
                                            background:
                                                "#fff7ed",
                                            fontSize:
                                                "23px",
                                            marginBottom:
                                                "12px",
                                        }}
                                    >
                                        🔔
                                    </div>

                                    <strong
                                        style={{
                                            color:
                                                "#374151",
                                            fontSize:
                                                "12px",
                                        }}
                                    >
                                        {
                                            text.noNotifications
                                        }
                                    </strong>

                                </div>
                            ) : (
                                notifications.map(
                                    (
                                        item
                                    ) => (
                                        <NotificationItem
                                            key={
                                                item.id
                                            }
                                            item={
                                                item
                                            }
                                            time={formatTime(
                                                item.created_at
                                            )}
                                            markRead={
                                                markRead
                                            }
                                            text={
                                                text
                                            }
                                        />
                                    )
                                )
                            )}

                        </div>


                        {/* =================================================
                            SOUND STATUS
                        ================================================= */}

                        {unreadCount >
                            0 &&
                            !audioReady && (
                                <div
                                    style={{
                                        padding:
                                            "9px 13px",
                                        borderTop:
                                            "1px solid #f1f5f9",
                                        background:
                                            "#fffaf5",
                                        color:
                                            "#9a3412",
                                        fontSize:
                                            "8px",
                                        textAlign:
                                            "center",
                                    }}
                                >
                                    🔊{" "}
                                    {isFrench
                                        ? "Touchez l'écran pour activer le son."
                                        : "Tap the screen to activate notification sound."}
                                </div>
                            )}

                    </div>

                </>
            )}

        </div>
    );
}


/* =========================================================
   NOTIFICATION ITEM
========================================================= */

function NotificationItem({
    item,
    time,
    markRead,
    text,
}) {
    const unread =
        !item.read;

    return (
        <div
            className="tayeb-fade-in"
            style={{
                position:
                    "relative",
                padding:
                    "13px",
                marginBottom:
                    "7px",
                borderRadius:
                    "16px",
                background:
                    unread
                        ? "#fff7ed"
                        : "#ffffff",
                border:
                    unread
                        ? "1px solid #fed7aa"
                        : "1px solid #f1f5f9",
            }}
        >

            <div
                style={{
                    display:
                        "flex",
                    gap:
                        "10px",
                }}
            >

                {/* ICON */}

                <div
                    style={{
                        width:
                            "34px",
                        height:
                            "34px",
                        flex:
                            "0 0 34px",
                        display:
                            "grid",
                        placeItems:
                            "center",
                        borderRadius:
                            "11px",
                        background:
                            unread
                                ? "#f97316"
                                : "#f3f4f6",
                        color:
                            unread
                                ? "white"
                                : "#6b7280",
                        fontSize:
                            "14px",
                    }}
                >
                    🔔
                </div>


                {/* CONTENT */}

                <div
                    style={{
                        flex:
                            1,
                        minWidth:
                            0,
                    }}
                >

                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            gap:
                                "8px",
                            alignItems:
                                "flex-start",
                        }}
                    >

                        <strong
                            style={{
                                color:
                                    "#111827",
                                fontSize:
                                    "11px",
                                fontWeight:
                                    900,
                                lineHeight:
                                    1.35,
                            }}
                        >
                            {
                                item.title
                            }
                        </strong>

                        {unread && (
                            <span
                                style={{
                                    width:
                                        "7px",
                                    height:
                                        "7px",
                                    flex:
                                        "0 0 7px",
                                    borderRadius:
                                        "50%",
                                    background:
                                        "#f97316",
                                    marginTop:
                                        "4px",
                                }}
                            />
                        )}

                    </div>


                    <p
                        style={{
                            margin:
                                "5px 0 0",
                            color:
                                "#6b7280",
                            fontSize:
                                "10px",
                            lineHeight:
                                1.55,
                        }}
                    >
                        {
                            item.message
                        }
                    </p>


                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            justifyContent:
                                "space-between",
                            gap:
                                "8px",
                            marginTop:
                                "9px",
                        }}
                    >

                        <span
                            style={{
                                color:
                                    "#9ca3af",
                                fontSize:
                                    "8px",
                            }}
                        >
                            {
                                time
                            }
                        </span>


                        {unread && (
                            <button
                                type="button"
                                onClick={() =>
                                    markRead(
                                        item.id
                                    )
                                }
                                style={{
                                    border:
                                        "0",
                                    background:
                                        "transparent",
                                    color:
                                        "#ea580c",
                                    fontSize:
                                        "8px",
                                    fontWeight:
                                        800,
                                    cursor:
                                        "pointer",
                                    padding:
                                        "2px",
                                }}
                            >
                                {
                                    text.markRead
                                }
                            </button>
                        )}

                    </div>

                </div>

            </div>

        </div>
    );
}