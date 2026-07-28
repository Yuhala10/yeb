import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/getCurrentUser";
import { logout } from "../lib/logout";

export default function DriverPage() {
    const router = useRouter();

    const [user, setUser] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            router.push("/login");
            return;
        }

        if (currentUser.role !== "DRIVER") {
            router.push("/");
            return;
        }

        setUser(currentUser);
        fetchShipments(currentUser.id);
    }, []);

    async function fetchShipments(driverId) {
        setLoading(true);

        const { data, error } = await supabase
            .from("shipments")
            .select("*")
            .or(`status.eq.OPEN,driver_id.eq.${driverId}`)
            .order("created_at", { ascending: false });

        if (error) {
            alert(error.message);
        } else {
            setShipments(data || []);
        }

        setLoading(false);
    }

    async function updateStatus(id, status) {
        const updates = {
            status,
        };

        if (status === "MATCHED") {
            updates.driver_id = user.id;
        }

        const { error } = await supabase
            .from("shipments")
            .update(updates)
            .eq("id", id);

        if (error) {
            alert(error.message);
            return;
        }

        // Trigger notification engine
        try {
            await fetch("/api/send-notification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    shipmentId: id,
                    eventType: status,
                }),
            });
        } catch (error) {
            console.error("Notification error:", error);
        }

        fetchShipments(user.id);
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <main className="max-w-md mx-auto p-5">

                <div className="flex justify-between items-center mb-6">

                    <div>
                        <h1 className="text-2xl font-black">
                            Welcome,
                        </h1>

                        <p className="text-amber-400 font-bold">
                            {user.full_name}
                        </p>
                    </div>

                    <button
                        onClick={() => logout(router)}
                        className="bg-red-600 px-4 py-2 rounded-xl font-bold"
                    >
                        Logout
                    </button>

                </div>

                {loading ? (

                    <div className="text-center py-12">
                        Loading...
                    </div>

                ) : shipments.length === 0 ? (

                    <div className="bg-slate-800 rounded-3xl p-8 text-center">
                        No shipments available.
                    </div>

                ) : (

                    shipments.map((item) => (

                        <div
                            key={item.id}
                            className="bg-slate-800 rounded-3xl p-5 mb-5"
                        >

                            <div className="flex justify-between">

                                <div>
                                    <h2 className="font-black text-lg">
                                        {item.item_type}
                                    </h2>

                                    <p className="text-sm text-slate-300">
                                        {item.quantity} units
                                    </p>
                                </div>

                                <div className="text-amber-400 font-black">
                                    {item.initial_offer} FCFA
                                </div>

                            </div>

                            <div className="mt-4 space-y-1 text-sm">

                                <p>📍 {item.origin}</p>

                                <p>🏁 {item.destination}</p>

                                <p>📞 {item.receiver_phone}</p>

                                <p className="font-bold mt-2">
                                    Status: {item.status}
                                </p>

                            </div>

                            <div className="mt-5">

                                {item.status === "OPEN" && (
                                    <button
                                        onClick={() => updateStatus(item.id, "MATCHED")}
                                        className="w-full bg-amber-400 text-slate-900 rounded-xl py-3 font-black"
                                    >
                                        ACCEPT SHIPMENT
                                    </button>
                                )}

                                {item.status === "MATCHED" &&
                                    item.driver_id === user.id && (
                                        <button
                                            onClick={() => updateStatus(item.id, "DEPARTED")}
                                            className="w-full bg-orange-500 rounded-xl py-3 font-black"
                                        >
                                            START JOURNEY
                                        </button>
                                    )}

                                {item.status === "DEPARTED" &&
                                    item.driver_id === user.id && (
                                        <button
                                            onClick={() => updateStatus(item.id, "ARRIVED")}
                                            className="w-full bg-green-600 rounded-xl py-3 font-black"
                                        >
                                            ARRIVED
                                        </button>
                                    )}

                                {item.status === "ARRIVED" &&
                                    item.driver_id === user.id && (
                                        <button
                                            onClick={() => updateStatus(item.id, "COMPLETED")}
                                            className="w-full bg-blue-600 rounded-xl py-3 font-black"
                                        >
                                            COMPLETE DELIVERY
                                        </button>
                                    )}

                            </div>

                        </div>

                    ))

                )}

            </main>
        </div>
    );
}