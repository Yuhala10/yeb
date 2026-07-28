import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/getCurrentUser";
import { logout } from "../lib/logout";

export default function ShipperPage() {
    const router = useRouter();

    const [user, setUser] = useState(null);

    const [itemType, setItemType] = useState("Bags/Sacks");
    const [origin, setOrigin] = useState("Douala (Akwa Market)");
    const [destination, setDestination] = useState("Yaoundé (Mvan Park)");
    const [quantity, setQuantity] = useState(3);
    const [offer, setOffer] = useState(12000);
    const [phone, setPhone] = useState("");

    const [loading, setLoading] = useState(false);
    const [posted, setPosted] = useState(false);

    useEffect(() => {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            router.push("/login");
            return;
        }

        if (currentUser.role !== "SHIPPER") {
            router.push("/");
            return;
        }

        setUser(currentUser);
        setPhone(currentUser.phone_number || "");
    }, []);

    async function handlePostCargo(e) {
        e.preventDefault();

        setLoading(true);

        const { error } = await supabase
            .from("shipments")
            .insert([
                {
                    shipper_id: user.id,
                    item_type: itemType,
                    origin,
                    destination,
                    quantity,
                    initial_offer: offer,
                    receiver_phone: phone,
                    status: "OPEN",
                },
            ]);

        setLoading(false);

        if (error) {
            alert(error.message);
            return;
        }

        setPosted(true);
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 pb-10">

            <div className="max-w-md mx-auto p-5">

                <div className="flex justify-between items-center mb-6">

                    <div>
                        <h1 className="text-2xl font-black">
                            Welcome,
                        </h1>

                        <p className="text-orange-600 font-bold">
                            {user.full_name}
                        </p>
                    </div>

                    <button
                        onClick={() => logout(router)}
                        className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold"
                    >
                        Logout
                    </button>

                </div>

                {posted ? (

                    <div className="bg-white rounded-3xl shadow-xl p-8 text-center">

                        <h2 className="text-2xl font-black text-green-600">
                            Cargo Posted!
                        </h2>

                        <p className="mt-3 text-slate-500">
                            Drivers can now see your shipment.
                        </p>

                        <button
                            onClick={() => setPosted(false)}
                            className="mt-6 w-full bg-slate-900 text-amber-400 rounded-2xl py-4 font-black"
                        >
                            Post Another Shipment
                        </button>

                    </div>

                ) : (

                    <form
                        onSubmit={handlePostCargo}
                        className="bg-white rounded-3xl shadow-xl p-6 space-y-5"
                    >

                        <h2 className="text-xl font-black">
                            New Shipment
                        </h2>

                        <select
                            value={itemType}
                            onChange={(e) => setItemType(e.target.value)}
                            className="w-full border rounded-xl p-3"
                        >
                            <option>Bags/Sacks</option>
                            <option>Crates/Boxes</option>
                            <option>Drums/Oil</option>
                            <option>Furniture/Bulky</option>
                        </select>

                        <input
                            value={origin}
                            onChange={(e) => setOrigin(e.target.value)}
                            placeholder="Origin"
                            className="w-full border rounded-xl p-3"
                        />

                        <input
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="Destination"
                            className="w-full border rounded-xl p-3"
                        />

                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full border rounded-xl p-3"
                        />

                        <input
                            type="number"
                            value={offer}
                            onChange={(e) => setOffer(Number(e.target.value))}
                            className="w-full border rounded-xl p-3"
                        />

                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Receiver Phone"
                            className="w-full border rounded-xl p-3"
                        />

                        <button
                            disabled={loading}
                            className="w-full bg-orange-600 text-white rounded-2xl py-4 font-black"
                        >
                            {loading ? "Posting..." : "Broadcast Shipment"}
                        </button>

                    </form>

                )}

            </div>

        </div>
    );
}