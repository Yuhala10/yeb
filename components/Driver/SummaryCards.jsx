export function SummaryCard({ value, title }) {
    return (
        <div className="bg-slate-800 rounded-2xl p-3 text-center">
            <p className="text-xl font-black">{value}</p>
            <p className="text-xs text-slate-400">{title}</p>
        </div>
    );
}

export default function SummaryCards({
    availableJobs,
    activeJobs,
    completedJobs,
}) {
    return (
        <div className="grid grid-cols-3 gap-3 mb-6">
            <SummaryCard
                value={availableJobs.length}
                title="Jobs"
            />

            <SummaryCard
                value={activeJobs.length}
                title="Active"
            />

            <SummaryCard
                value={completedJobs.length}
                title="Done"
            />
        </div>
    );
}