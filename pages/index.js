import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";

export default function Home() {
    const router = useRouter();
    const { language, changeLanguage } = useLanguage();

    useEffect(() => {
        if (typeof window === "undefined") return;

        const stored = localStorage.getItem("tayebUser");

        if (!stored) return;

        try {
            const user = JSON.parse(stored);

            if (user?.role === "DRIVER") {
                router.replace("/driver");
                return;
            }

            if (user?.role === "SHIPPER") {
                router.replace("/shipper");
                return;
            }

            if (user?.role === "ADMIN") {
                router.replace("/admin");
                return;
            }
        } catch (error) {
            console.error("Invalid saved user:", error);
            localStorage.removeItem("tayebUser");
        }
    }, [router]);

    const text = {
        en: {
            title: "Move. Manage. Deliver.",
            subtitle:
                "Cameroon's trusted logistics marketplace connecting shippers and drivers.",
            shipper: "I Want to Send Cargo",
            shipperDesc:
                "Post cargo, receive competitive bids, and choose the best driver.",
            driver: "I Am a Driver",
            driverDesc:
                "Browse available shipments, submit bids, and earn more deliveries.",
            merchant: "For Shippers",
            transporter: "For Drivers",
            feedback: "💬 Share Feedback",
            admin: "⚙️ Admin",
            features: "Why Tayeb?",
            f1: "Fast cargo matching",
            f2: "Competitive driver bidding",
            f3: "Secure shipment management",
            f4: "Built for Cameroon",
        },

        fr: {
            title: "Déplacer. Gérer. Livrer.",
            subtitle:
                "La plateforme logistique du Cameroun reliant expéditeurs et chauffeurs.",
            shipper: "Envoyer un colis",
            shipperDesc:
                "Publiez votre cargaison et choisissez la meilleure offre.",
            driver: "Je suis chauffeur",
            driverDesc:
                "Consultez les cargaisons disponibles et soumettez vos offres.",
            merchant: "Expéditeurs",
            transporter: "Chauffeurs",
            feedback: "💬 Donner un avis",
            admin: "⚙️ Admin",
            features: "Pourquoi Tayeb ?",
            f1: "Attribution rapide",
            f2: "Système d'offres",
            f3: "Gestion sécurisée",
            f4: "Conçu pour le Cameroun",
        },
    };

    const t = text[language];

    const saveRole = (role) => {
        localStorage.setItem("selectedRole", role);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-100">

            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
                <div className="max-w-md mx-auto flex items-center justify-between px-5 py-4">

                    <BrandLogo size={55} />

                    <div className="flex items-center gap-2">

                        <button
                            onClick={() => changeLanguage("en")}
                            className={`px-3 py-1 rounded-lg text-sm font-bold ${language === "en"
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-200"
                                }`}
                        >
                            EN
                        </button>

                        <button
                            onClick={() => changeLanguage("fr")}
                            className={`px-3 py-1 rounded-lg text-sm font-bold ${language === "fr"
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-200"
                                }`}
                        >
                            FR
                        </button>

                        <Link
                            href="/admin"
                            className="bg-slate-900 text-amber-400 px-3 py-2 rounded-xl font-bold text-xs"
                        >
                            {t.admin}
                        </Link>

                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-5 py-8">

                <div className="text-center">

                    <BrandLogo size={150} />

                    <h1 className="text-4xl font-black mt-6 text-slate-900">
                        {t.title}
                    </h1>

                    <p className="mt-4 text-slate-500 leading-relaxed">
                        {t.subtitle}
                    </p>

                </div>

                <div className="mt-10 space-y-5">

                    <Link
                        href="/login"
                        onClick={() => saveRole("SHIPPER")}
                        className="block bg-white rounded-3xl shadow-xl border border-orange-100 p-6 hover:scale-[1.02] transition-all"
                    >

                        <div className="flex items-center justify-between">

                            <span className="text-5xl">
                                📦
                            </span>

                            <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-black uppercase">
                                {t.merchant}
                            </span>

                        </div>

                        <h2 className="text-2xl font-black mt-5 text-slate-900">
                            {t.shipper}
                        </h2>

                        <p className="text-slate-500 mt-2">
                            {t.shipperDesc}
                        </p>

                    </Link>

                    <Link
                        href="/login"
                        onClick={() => saveRole("DRIVER")}
                        className="block bg-slate-900 rounded-3xl shadow-xl p-6 hover:scale-[1.02] transition-all"
                    >

                        <div className="flex items-center justify-between">

                            <span className="text-5xl">
                                🚚
                            </span>

                            <span className="bg-amber-400 text-slate-900 px-3 py-1 rounded-full text-xs font-black uppercase">
                                {t.transporter}
                            </span>

                        </div>

                        <h2 className="text-2xl font-black mt-5 text-amber-400">
                            {t.driver}
                        </h2>

                        <p className="text-slate-300 mt-2">
                            {t.driverDesc}
                        </p>

                    </Link>

                </div>

                <section className="mt-10 bg-white rounded-3xl shadow-lg p-6">

                    <h3 className="text-xl font-black text-slate-900 mb-5">
                        {t.features}
                    </h3>

                    <div className="space-y-4">

                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚡</span>
                            <span>{t.f1}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xl">💰</span>
                            <span>{t.f2}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xl">🛡️</span>
                            <span>{t.f3}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xl">🇨🇲</span>
                            <span>{t.f4}</span>
                        </div>

                    </div>

                </section>

                <div className="text-center mt-10">

                    <Link
                        href="/feedback"
                        className="text-orange-600 font-bold hover:text-orange-700 transition"
                    >
                        {t.feedback}
                    </Link>

                </div>

            </main>

            <footer className="mt-12 border-t bg-white">

                <div className="max-w-md mx-auto px-5 py-8 text-center">

                    <BrandLogo size={60} />

                    <p className="mt-4 text-sm text-slate-500">
                        © {new Date().getFullYear()} Tayeb
                    </p>

                    <p className="text-xs text-slate-400 mt-2">
                        Move. Manage. Deliver.
                    </p>

                </div>

            </footer>

        </div>
    );
}