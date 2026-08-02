import { useState } from "react";
import { useRouter } from "next/router";
import supabase from "../../lib/supabaseClient";

export default function DeleteAccount({ user }) {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    async function handleDelete() {
        if (!user) return;

        setLoading(true);

        try {
            // Delete notifications (ignore if table doesn't exist)
            try {
                await supabase
                    .from("notifications")
                    .delete()
                    .eq("user_id", user.id);
            } catch (e) {
                console.log("Notifications table skipped.");
            }

            // Delete bids made by this driver
            try {
                await supabase
                    .from("bids")
                    .delete()
                    .eq("driver_id", user.id);
            } catch (e) {
                console.log("Bids skipped.");
            }

            // Delete shipments created by this shipper
            try {
                await supabase
                    .from("shipments")
                    .delete()
                    .eq("shipper_id", user.id);
            } catch (e) {
                console.log("Shipments skipped.");
            }

            // Delete subscriptions
            try {
                await supabase
                    .from("subscriptions")
                    .delete()
                    .eq("user_id", user.id);
            } catch (e) {
                console.log("Subscriptions skipped.");
            }

            // Finally delete the user account
            const { error } = await supabase
                .from("users")
                .delete()
                .eq("id", user.id);

            if (error) {
                alert(error.message);
                setLoading(false);
                return;
            }

            localStorage.removeItem("tayebUser");
            localStorage.removeItem("selectedRole");

            alert("Your account has been deleted successfully.");

            router.push("/");

        } catch (err) {
            console.error(err);
            alert("Failed to delete account.");
        }

        setLoading(false);
    }

    return (
        <div className="bg-white rounded-3xl shadow-xl p-5 mt-6">
            <h2 className="text-lg font-black mb-3">
                Account Settings
            </h2>

            <p className="text-sm text-slate-500 mb-4">
                Permanently delete your Tayeb account.
            </p>

            {!confirmDelete ? (
                <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full bg-red-600 text-white rounded-xl py-3 font-bold"
                >
                    Delete Account
                </button>
            ) : (
                <>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p className="font-bold text-red-700">
                            This action cannot be undone.
                        </p>

                        <p className="text-sm mt-2">
                            Your profile, shipments, bids,
                            subscriptions and notifications
                            will be permanently deleted.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 bg-slate-200 rounded-xl py-3 font-bold"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex-1 bg-red-600 text-white rounded-xl py-3 font-bold"
                        >
                            {loading ? "Deleting..." : "Delete Forever"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}