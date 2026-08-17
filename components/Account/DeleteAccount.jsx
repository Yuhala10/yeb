import { useState } from "react";
import { useRouter } from "next/router";

export default function DeleteAccount({ user }) {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    async function handleDelete() {
        if (!user || loading) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                "/api/account/delete",
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const result = await response.json();

            if (!response.ok) {
                alert(
                    result?.error ||
                    "Failed to delete account."
                );

                setLoading(false);
                return;
            }

            // Clear local Tayeb data
            localStorage.removeItem(
                "tayebUser"
            );

            localStorage.removeItem(
                "selectedRole"
            );

            alert(
                "Your account has been deleted successfully."
            );

            router.replace("/");

        } catch (error) {
            console.error(
                "Account deletion error:",
                error
            );

            alert(
                "Unable to delete your account. Please try again."
            );

            setLoading(false);
        }
    }

    return (
        <div className="bg-white rounded-3xl shadow-xl p-5 mt-6">

            <h2 className="text-lg font-black mb-2">
                Account Settings
            </h2>

            <p className="text-sm text-slate-500 mb-5">
                Manage your Tayeb account.
            </p>

            {!confirmDelete ? (
                <button
                    type="button"
                    onClick={() =>
                        setConfirmDelete(true)
                    }
                    className="
                        w-full
                        bg-red-600
                        hover:bg-red-700
                        text-white
                        rounded-2xl
                        py-3.5
                        font-bold
                        transition
                        active:scale-[0.98]
                    "
                >
                    Delete Account
                </button>
            ) : (
                <div className="space-y-4">

                    <div
                        className="
                            bg-red-50
                            border
                            border-red-200
                            rounded-2xl
                            p-4
                        "
                    >
                        <p className="font-black text-red-700">
                            Delete your account?
                        </p>

                        <p className="text-sm text-red-600 mt-2 leading-6">
                            This action cannot be undone.
                            Your Tayeb profile and associated
                            account data will be permanently
                            deleted.
                        </p>
                    </div>

                    <div className="flex gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                setConfirmDelete(false)
                            }
                            disabled={loading}
                            className="
                                flex-1
                                bg-slate-100
                                hover:bg-slate-200
                                text-slate-800
                                rounded-2xl
                                py-3
                                font-bold
                                transition
                            "
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="
                                flex-1
                                bg-red-600
                                hover:bg-red-700
                                text-white
                                rounded-2xl
                                py-3
                                font-bold
                                transition
                                disabled:opacity-60
                            "
                        >
                            {loading
                                ? "Deleting..."
                                : "Delete Forever"}
                        </button>

                    </div>
                </div>
            )}
        </div>
    );
}