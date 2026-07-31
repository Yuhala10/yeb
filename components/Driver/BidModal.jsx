import { useState } from "react";

export default function BidModal({
    open,
    onClose,
    onSubmit,
    shipment,
}) {
    const [price, setPrice] = useState("");
    const [eta, setEta] = useState("");
    const [note, setNote] = useState("");

    if (!open || !shipment) return null;

    function submitBid() {
        if (!price.trim() || !eta.trim()) {
            alert("Please enter your price and ETA.");
            return;
        }

        onSubmit({
            price: Number(price),
            eta,
            note,
        });

        setPrice("");
        setEta("");
        setNote("");
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

            <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-md mx-4">

                <h2 className="text-xl font-black mb-2">
                    Submit Bid
                </h2>

                <p className="text-slate-400 mb-5">
                    {shipment.item_type}
                </p>

                <input
                    type="number"
                    placeholder="Your Price (FCFA)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-3 rounded-xl text-black mb-3"
                />

                <input
                    placeholder="Estimated Arrival Time"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full p-3 rounded-xl text-black mb-3"
                />

                <textarea
                    placeholder="Optional note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-3 rounded-xl text-black mb-5"
                    rows={4}
                />

                <div className="flex gap-3">

                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-600 rounded-xl py-3 font-bold"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={submitBid}
                        className="flex-1 bg-amber-400 text-slate-900 rounded-xl py-3 font-black"
                    >
                        Submit Bid
                    </button>

                </div>

            </div>

        </div>
    );
}