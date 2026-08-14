import { useEffect, useRef, useState } from "react";
import supabase from "../lib/supabaseClient";

export default function Notifications({ userId }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const notificationSound = useRef(null);

    // =========================================================
    // LOAD TAYEB NOTIFICATION SOUND
    // =========================================================

    useEffect(() => {
        if (typeof window === "undefined") return;

        notificationSound.current = new Audio(
            "/sounds/notification.mp3"
        );

        notificationSound.current.preload = "auto";

        return () => {
            if (notificationSound.current) {
                notificationSound.current.pause();
                notificationSound.current = null;
            }
        };
    }, []);

    // =========================================================
    // PLAY NOTIFICATION SOUND
    // =========================================================

    function playNotificationSound() {
        try {
            if (!notificationSound.current) return;

            notificationSound.current.currentTime = 0;

            notificationSound.current
                .play()
                .catch((error) => {
                    console.log(
                        "Notification sound blocked by browser:",
                        error
                    );
                });
        } catch (error) {
            console.log(
                "Notification sound error:",
                error
            );
        }
    }

    // =========================================================
    // FETCH + REALTIME NOTIFICATIONS
    // =========================================================

    useEffect(() => {
        if (!userId) return;

        fetchNotifications();

        const channel = supabase
            .channel(`notifications-${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    console.log(
                        "🔔 New notification:",
                        payload.new
                    );

                    setNotifications((current) => [
                        payload.new,
                        ...current,
                    ]);

                    // 🔊 PLAY TAYEB SOUND
                    playNotificationSound();
                }
            )
            .subscribe((status) => {
                console.log(
                    "Notification realtime status:",
                    status
                );
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // =========================================================
    // FETCH NOTIFICATIONS
    // =========================================================

    async function fetchNotifications() {
        if (!userId) return;

        setLoading(true);

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", {
                ascending: false,
            });

        if (error) {
            console.log(
                "Notification fetch error:",
                error
            );
        } else {
            setNotifications(data || []);
        }

        setLoading(false);
    }

    // =========================================================
    // MARK AS READ
    // =========================================================

    async function markRead(id) {
        const { error } = await supabase
            .from("notifications")
            .update({
                read: true,
            })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) {
            console.log(
                "Mark notification read error:",
                error
            );

            return;
        }

        setNotifications((current) =>
            current.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        read: true,
                    }
                    : item
            )
        );
    }

    // =========================================================
    // UI
    // =========================================================

    return (
        <div className="bg-white rounded-3xl shadow p-5 mb-6">

            <div className="flex items-center justify-between mb-4">

                <h2 className="font-black text-lg">
                    🔔 Notifications
                </h2>

                {notifications.some(
                    (item) => !item.read
                ) && (
                        <span className="bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-full">
                            {
                                notifications.filter(
                                    (item) => !item.read
                                ).length
                            }
                        </span>
                    )}

            </div>

            {loading ? (
                <p>
                    Loading...
                </p>
            ) : notifications.length === 0 ? (
                <p className="text-slate-500">
                    No notifications yet.
                </p>
            ) : (
                notifications.map((item) => (
                    <div
                        key={item.id}
                        className={`border rounded-2xl p-4 mb-3 ${item.read
                                ? "bg-white"
                                : "bg-orange-50 border-orange-200"
                            }`}
                    >

                        <div className="flex justify-between items-start gap-3">

                            <p className="font-bold">
                                {item.title}
                            </p>

                            {!item.read && (
                                <span className="w-2.5 h-2.5 bg-orange-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}

                        </div>

                        <p className="text-sm text-slate-600 mt-1">
                            {item.message}
                        </p>

                        {item.created_at && (
                            <p className="text-xs text-slate-400 mt-2">
                                {new Date(
                                    item.created_at
                                ).toLocaleString()}
                            </p>
                        )}

                        {!item.read && (
                            <button
                                onClick={() =>
                                    markRead(item.id)
                                }
                                className="mt-3 text-sm bg-slate-900 text-white px-3 py-2 rounded-xl"
                            >
                                Mark Read
                            </button>
                        )}

                    </div>
                ))
            )}

        </div>
    );
}