import BrandLogo from "../BrandLogo";
import { logout } from "../../lib/logout";

export default function DriverHeader({
    user,
    router,
    t,
    language,
    changeLanguage,
}) {
    return (
        <>
            {/* LANGUAGE */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => changeLanguage("en")}
                    className={`px-3 py-1 rounded-l-lg text-sm ${language === "en"
                            ? "bg-amber-400 text-slate-900"
                            : "bg-slate-700"
                        }`}
                >
                    EN
                </button>

                <button
                    onClick={() => changeLanguage("fr")}
                    className={`px-3 py-1 rounded-r-lg text-sm ${language === "fr"
                            ? "bg-amber-400 text-slate-900"
                            : "bg-slate-700"
                        }`}
                >
                    FR
                </button>
            </div>

            {/* HEADER */}
            <div className="bg-slate-800 rounded-3xl p-5 mb-6">
                <div className="flex justify-center mb-5">
                    <BrandLogo size="120" />
                </div>

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black">
                            {t.welcome},
                        </h1>

                        <p className="text-amber-400 font-bold">
                            {user.full_name}
                        </p>

                        <p className="text-sm text-slate-400">
                            Driver
                        </p>
                    </div>

                    <button
                        onClick={() => logout(router)}
                        className="bg-red-600 px-4 py-2 rounded-xl font-bold"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </>
    );
}