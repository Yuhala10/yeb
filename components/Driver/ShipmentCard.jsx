import { useState } from "react";
import DeliveryTracker from "./DeliveryTracker";

export default function ShipmentCard({
    item,
    user,
    driverBid,
    updateStatus,
    onBid,
    onAcceptCounterPrice,
    onSuggestAnotherPrice,
}) {
    const [newPrice, setNewPrice] = useState("");

    const isMyShipment =
        item.driver_id === user.id;

    const submitAnotherPrice = () => {
        if (!newPrice || Number(newPrice) <= 0) {
            alert("Please enter a valid price.");
            return;
        }

        onSuggestAnotherPrice(
            driverBid,
            newPrice
        );

        setNewPrice("");
    };

    return (
        <div className="bg-slate-800 rounded-3xl p-5 mb-5">

            {/* HEADER */}
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


            {/* SHIPMENT DETAILS */}
            <div className="mt-4 space-y-2 text-sm">

                <p>
                    📍 {item.origin}
                </p>

                <p>
                    🏁 {item.destination}
                </p>

                <p>
                    📞 Receiver: {item.receiver_phone}
                </p>

                {item.shipper && (
                    <>
                        <p className="mt-3 font-bold text-amber-400">
                            Sender Details
                        </p>

                        <p>
                            👤 {item.shipper.full_name}
                        </p>

                        <p>
                            📱 {item.shipper.phone_number}
                        </p>
                    </>
                )}

                <p className="font-bold">
                    Status: {item.status}
                </p>

            </div>


            <DeliveryTracker item={item} />


            {/* =====================================================
                ACTIONS
            ====================================================== */}

            <div className="mt-5">


                {/* =================================================
                    DRIVER HAS NOT SENT A PRICE
                ================================================= */}

                {item.status === "OPEN" &&
                    !driverBid && (
                        <button
                            onClick={() =>
                                onBid(item)
                            }
                            className="w-full bg-amber-400 text-slate-900 rounded-xl py-3 font-black"
                        >
                            SUGGEST A PRICE
                        </button>
                    )}


                {/* =================================================
                   {/* DRIVER'S PRICE IS WAITING */}
                ================================================= */

                {driverBid?.status === "COUNTERED" &&
                    driverBid.last_offer_by === "SHIPPER" && (
                        <div className="bg-amber-100 border border-amber-400 rounded-xl p-4 text-center">

                            <p className="font-black text-amber-700">
                                ⏳ Waiting for the sender's response...
                            </p>

                            <p className="text-sm text-amber-800 mt-2">
                                Your price:
                            </p>

                            <p className="text-xl font-black text-amber-700 mt-1">
                                {driverBid.proposed_price} FCFA
                            </p>

                        </div>
                    )}


                {/* =================================================
                    SENDER HAS SUGGESTED ANOTHER PRICE
                ================================================= */}

                {driverBid?.status === "COUNTERED" &&
                    driverBid.last_offer_by === "SHIPPER" && (
                        <div className="bg-blue-100 border border-blue-400 rounded-xl p-4">

                            <p className="font-black text-blue-700 text-center">
                                📩 The sender suggested another price
                            </p>

                            <p className="text-sm text-blue-800 text-center mt-3">
                                New price:
                            </p>

                            <p className="text-2xl font-black text-blue-700 text-center mt-1">
                                {driverBid.counter_price} FCFA
                            </p>


                            <button
                                onClick={() =>
                                    onAcceptCounterPrice(
                                        driverBid
                                    )
                                }
                                className="w-full bg-green-600 text-white rounded-xl py-3 font-black mt-4"
                            >
                                ACCEPT THIS PRICE
                            </button>


                            <div className="mt-4">

                                <p className="text-sm font-bold text-blue-800 mb-2">
                                    Or suggest another price:
                                </p>

                                <input
                                    type="number"
                                    min="1"
                                    placeholder="Enter your price"
                                    value={newPrice}
                                    onChange={(e) =>
                                        setNewPrice(
                                            e.target.value
                                        )
                                    }
                                    className="w-full bg-white text-slate-900 border border-blue-300 rounded-xl px-4 py-3 mb-3"
                                />

                                <button
                                    onClick={
                                        submitAnotherPrice
                                    }
                                    className="w-full bg-slate-900 text-amber-400 rounded-xl py-3 font-black"
                                >
                                    SUGGEST ANOTHER PRICE
                                </button>

                            </div>

                        </div>
                    )}


                {/* =================================================
                    AGREED
                ================================================= */}

                {driverBid?.status === "ACCEPTED" &&
                    isMyShipment && (
                        <>

                            <div className="bg-green-100 border border-green-400 rounded-xl p-4 mb-3">

                                <p className="font-black text-green-700 text-center">
                                    🤝 PRICE AGREED
                                </p>

                                <p className="text-center mt-3 text-sm">
                                    Agreed price:
                                </p>

                                <p className="text-2xl font-black text-green-700 text-center mt-1">
                                    {item.agreed_price ||
                                        driverBid.proposed_price}{" "}
                                    FCFA
                                </p>

                                <p className="mt-4 text-sm text-center">
                                    You can now contact the sender to arrange pickup.
                                </p>

                                {item.shipper?.phone_number && (
                                    <p className="mt-3 font-black text-center">
                                        📞{" "}
                                        {item.shipper.phone_number}
                                    </p>
                                )}

                            </div>


                            {/* START JOURNEY */}

                            {item.status === "MATCHED" && (
                                <button
                                    onClick={() =>
                                        updateStatus(
                                            item.id,
                                            "DEPARTED"
                                        )
                                    }
                                    className="w-full bg-orange-500 rounded-xl py-3 font-black"
                                >
                                    START JOURNEY
                                </button>
                            )}

                        </>
                    )}


                {/* =================================================
                    JOURNEY IN PROGRESS
                ================================================= */}

                {item.status === "DEPARTED" &&
                    isMyShipment && (
                        <button
                            onClick={() =>
                                updateStatus(
                                    item.id,
                                    "ARRIVED"
                                )
                            }
                            className="w-full bg-green-600 rounded-xl py-3 font-black"
                        >
                            ARRIVED
                        </button>
                    )}


                {/* =================================================
                    REJECTED
                ================================================= */}

                {driverBid?.status === "REJECTED" && (
                    <div className="bg-red-100 border border-red-300 rounded-xl p-4 text-center">

                        <p className="font-black text-red-700">
                            ❌ Another driver was selected
                        </p>

                        <p className="text-sm mt-2 text-red-800">
                            This delivery has been given to another driver.
                        </p>

                        <p className="text-sm mt-2 text-red-800">
                            Thank you for your price.
                        </p>

                    </div>
                )}

            </div>

        </div>
    );
}