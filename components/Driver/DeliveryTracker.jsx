export default function DeliveryTracker({ item }) {
    return (
        <div className="mt-5 bg-slate-700 rounded-2xl p-3">

            <p className="font-bold mb-2">
                Delivery Progress
            </p>

            <div className="flex justify-between text-xs">

                <span
                    className={
                        item.status !== "OPEN"
                            ? "text-amber-400 font-bold"
                            : ""
                    }
                >
                    Accepted
                </span>

                <span
                    className={
                        item.status === "DEPARTED" ||
                            item.status === "ARRIVED" ||
                            item.status === "COMPLETED"
                            ? "text-amber-400 font-bold"
                            : ""
                    }
                >
                    On Way
                </span>

                <span
                    className={
                        item.status === "COMPLETED"
                            ? "text-green-400 font-bold"
                            : ""
                    }
                >
                    Delivered
                </span>

            </div>

        </div>
    );
}