import DeliveryTracker from "./DeliveryTracker";

export default function ShipmentCard({
    item,
    user,
    driverBid,
    updateStatus,
    onBid,
}) {
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

                <p>📍 {item.origin}</p>

                <p>🏁 {item.destination}</p>

                <p>📞 Receiver: {item.receiver_phone}</p>

                {item.shipper && (
                    <>
                        <p className="mt-3 font-bold text-amber-400">
                            Shipper Details
                        </p>

                        <p>👤 {item.shipper.full_name}</p>

                        <p>📱 {item.shipper.phone_number}</p>
                    </>
                )}

                <p className="font-bold">
                    Status: {item.status}
                </p>

            </div>

            <DeliveryTracker item={item} />

            {/* ACTION BUTTONS */}
            <div className="mt-5">



                {item.status === "DEPARTED" &&
                    item.driver_id === user.id && (
                        <button
                            onClick={() =>
                                updateStatus(item.id, "ARRIVED")
                            }
                            className="w-full bg-green-600 rounded-xl py-3 font-black"
                        >
                            ARRIVED
                        </button>
                    )}

                {/* Driver has not bid */}
                {item.status === "OPEN" && !driverBid && (
                    <button
                        onClick={() => onBid(item)}
                        className="w-full bg-amber-400 text-slate-900 rounded-xl py-3 font-black"
                    >
                        SUBMIT BID
                    </button>
                )}

                {/* Waiting */}
                {driverBid?.status === "PENDING" && (
                    <div className="bg-amber-100 border border-amber-400 rounded-xl p-4 text-center">
                        <p className="font-black text-amber-700">
                            ⏳ Waiting for shipper's decision...
                        </p>
                    </div>
                )}

                {/* Accepted */}
                {driverBid?.status === "ACCEPTED" &&
                    item.driver_id === user.id && (
                        <>
                            <div className="bg-green-100 border border-green-400 rounded-xl p-4 mb-3">
                                <p className="font-black text-green-700">
                                    🎉 Your bid has been accepted!
                                </p>

                                <p className="mt-2 text-sm">
                                    Please contact the shipper to arrange pickup.
                                </p>

                                <p className="mt-2 font-bold">
                                    📞 {item.shipper?.phone_number}
                                </p>
                            </div>

                            <button
                                onClick={() =>
                                    updateStatus(item.id, "DEPARTED")
                                }
                                className="w-full bg-orange-500 rounded-xl py-3 font-black"
                            >
                                START JOURNEY
                            </button>
                        </>
                    )}

                {/* Rejected */}
                {driverBid?.status === "REJECTED" && (
                    <div className="bg-red-100 border border-red-300 rounded-xl p-4 text-center">
                        <p className="font-black text-red-700">
                            ❌ Another driver was selected.
                        </p>

                        <p className="text-sm mt-2">
                            Thank you for submitting your offer.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}