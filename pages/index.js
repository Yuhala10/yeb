import Link from 'next/link';

export default function Home() {

  const saveRole = (role) => {
    localStorage.setItem('selectedRole', role);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 antialiased">

      {/* NAVBAR */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 px-5 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">

          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-amber-400 to-amber-300 rounded-2xl flex items-center justify-center font-extrabold text-2xl text-slate-900 shadow-md">
              T
            </div>

            <div>
              <h1 className="font-extrabold text-xl tracking-tight leading-none">
                TAYEB
              </h1>

              <p className="text-[10px] font-bold tracking-wide uppercase text-orange-600 mt-0.5">
                Cameroon Freight
              </p>
            </div>
          </div>

          <Link
            href="/admin"
            className="bg-slate-900 text-amber-400 font-bold text-xs px-3.5 py-2.5 rounded-xl btn-bounce"
          >
            ⚙️ Admin
          </Link>

        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-8 space-y-6">

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Overland Cargo Network
          </h2>

          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Connect directly with drivers on the Douala - Yaoundé corridor with
            0 escrow delays.
          </p>
        </div>

        {/* ROLE CHOICE CARDS */}
        <div className="space-y-4 pt-2">

          <Link
            href="/login"
            onClick={() => saveRole('SHIPPER')}
            className="block bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg hover-card-rise btn-bounce group relative overflow-hidden"
          >

            <div className="flex justify-between items-start">
              <span className="text-4xl">📦</span>

              <span className="bg-orange-100 text-orange-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
                For Merchants
              </span>
            </div>

            <div className="mt-4">
              <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-orange-600 transition-colors">
                I Want to Send Cargo
              </h3>

              <p className="text-xs text-slate-400 mt-1">
                Post bags, crates, drums or bulky items and get live driver bids
                instantly.
              </p>
            </div>

          </Link>

          <Link
            href="/login"
            onClick={() => saveRole('DRIVER')}
            className="block bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl hover-card-rise btn-bounce group relative overflow-hidden"
          >

            <div className="flex justify-between items-start">
              <span className="text-4xl">🚚</span>

              <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase">
                For Transporters
              </span>
            </div>

            <div className="mt-4">
              <h3 className="font-extrabold text-lg text-amber-400">
                I Am A Driver
              </h3>

              <p className="text-xs text-slate-300 mt-1">
                Browse active market cargo, place counter-bids, and collect cash
                on delivery.
              </p>
            </div>

          </Link>

        </div>

        <div className="text-center pt-4">
          <Link
            href="/feedback"
            className="text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors"
          >
            💬 Share Feedback or Report an Issue
          </Link>
        </div>

      </main>

    </div>
  );
}