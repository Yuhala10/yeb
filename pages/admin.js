import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";

const ADMIN_PHONE = "681731512";

export default function AdminDashboard() {
    const router = useRouter();

    const [authorised, setAuthorised] = useState(false);
    const [pendingSubs, setPendingSubs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem("tayebUser");

        if (!saved) {
            router.replace("/login");
            return;
        }

        const user = JSON.parse(saved);

        if (
            user.role !== "ADMIN" ||
            user.phone_number !== ADMIN_PHONE
        ) {
            router.replace("/");
            return;
        }

        setAuthorised(true);
        fetchPendingSubs();
    }, []);

    async function fetchPendingSubs() {
        setLoading(true);

        const { data: subscriptions, error } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("status", "PENDING")
            .order("created_at", { ascending: false });

        if (error) {
            alert(error.message);
            setLoading(false);
            return;
        }

        const results = await Promise.all(
            (subscriptions || []).map(async (sub) => {
                const { data: user } = await supabase
                    .from("users")
                    .select("id, full_name, phone_number, role")
                    .eq("id", sub.user_id)
                    .single();

                return {
                    ...sub,
                    user,
                };
            })
        );

        setPendingSubs(results);
        setLoading(false);
    }

    async function handleApprove(subId, userId) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 32);

        await supabase
            .from("subscriptions")
            .update({ status: "APPROVED" })
            .eq("id", subId);

        await supabase
            .from("users")
            .update({
                subscription_expires_at: expiry.toISOString(),
            })
            .eq("id", userId);

        fetchPendingSubs();
    }

    function logoutAdmin() {
        localStorage.removeItem("tayebUser");
        router.push("/login");
    }

    if (!authorised) return null;

    return (
        <div className="min-h-screen bg-gray-50 max-w-lg mx-auto p-4">

            <div className="flex justify-between items-center mb-5">

                <div>
                    <h1 className="text-2xl font-black">
                        Tayeb Admin
                    </h1>

                    <p className="text-gray-500">
                        Platform Control Panel
                    </p>
                </div>

                <button
                    onClick={logoutAdmin}
                    className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"
                >
                    Logout
                </button>

            </div>

            {/* Keep the rest of your existing admin UI here */}
        </div>
    );
}