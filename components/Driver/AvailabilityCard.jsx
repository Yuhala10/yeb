export default function AvailabilityCard({
    available,
    toggleAvailability,
}) {
    return (
        <div className="bg-slate-800 rounded-3xl p-5 mb-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="font-black">
                        Availability
                    </h2>

                    <p className="text-sm text-slate-400">
                        {available
                            ? "🟢 Available"
                            : "🔴 Busy"}
                    </p>
                </div>

                <button
                    onClick={toggleAvailability}
                    className={`px-5 py-2 rounded-xl font-black ${available
                            ? "bg-green-600"
                            : "bg-red-600"
                        }`}
                >
                    {available ? "ON" : "OFF"}
                </button>
            </div>
        </div>
    );
}