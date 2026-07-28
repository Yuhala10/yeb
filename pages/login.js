import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const ADMIN_PHONE = "681731512";
const ADMIN_PIN = "03035 02027";

export default function LoginPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("SHIPPER");
    const [adminPin, setAdminPin] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const savedRole = localStorage.getItem("selectedRole");

        if (savedRole) {
            setRole(savedRole);
        }
    }, []);

    const isAdminPhone = phone.trim() === ADMIN_PHONE;

    async function handleLogin(e) {
        e.preventDefault();

        setLoading(true);

        // ADMIN LOGIN
        if (isAdminPhone) {
            if (adminPin !== ADMIN_PIN) {
                alert("Incorrect admin PIN.");
                setLoading(false);
                return;
            }

            const adminUser = {
                id: "admin",
                full_name: "Platform Administrator",
                phone_number: ADMIN_PHONE,
                role: "ADMIN",
            };

            localStorage.setItem(
                "tayebUser",
                JSON.stringify(adminUser)
            );

            setLoading(false);
            router.push("/admin");
            return;
        }

        // NORMAL USER LOGIN
        const { data: existingUser } = await supabase
            .from("users")
            .select("*")
            .eq("phone_number", phone)
            .single();

        let user = existingUser;

        if (!user) {
            const { data: newUser, error } = await supabase
                .from("users")
                .insert([
                    {
                        full_name: name,
                        phone_number: phone,
                        role: role,
                    },
                ])
                .select()
                .single();

            if (error) {
                alert(error.message);
                setLoading(false);
                return;
            }

            user = newUser;
        }

        localStorage.setItem("tayebUser", JSON.stringify(user));

        setLoading(false);

        if (user.role === "DRIVER") {
            router.push("/driver");
            return;
        }

        router.push("/shipper");
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">

            <form
                onSubmit={handleLogin}
                className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full space-y-5"
            >

                <h1 className="text-2xl font-black text-center">
                    Welcome to Tayeb
                </h1>

                <p className="text-center text-slate-500 text-sm">
                    Login or create your account
                </p>

                <input
                    type="text"
                    placeholder="Full Name"
                    required={!isAdminPhone}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isAdminPhone}
                    className="w-full border rounded-xl px-4 py-3 disabled:bg-gray-100"
                />

                <input
                    type="text"
                    placeholder="Phone Number"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3"
                />

                {isAdminPhone && (
                    <input
                        type="password"
                        placeholder="Admin PIN"
                        required
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3"
                    />
                )}

                {!isAdminPhone && (
                    <div className="grid grid-cols-2 gap-3">

                        <button
                            type="button"
                            onClick={() => setRole("SHIPPER")}
                            className={`py-3 rounded-xl font-bold ${role === "SHIPPER"
                                ? "bg-orange-600 text-white"
                                : "bg-slate-200"
                                }`}
                        >
                            Shipper
                        </button>

                        <button
                            type="button"
                            onClick={() => setRole("DRIVER")}
                            className={`py-3 rounded-xl font-bold ${role === "DRIVER"
                                ? "bg-orange-600 text-white"
                                : "bg-slate-200"
                                }`}
                        >
                            Driver
                        </button>

                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-amber-400 py-4 rounded-2xl font-black"
                >
                    {loading ? "PLEASE WAIT..." : isAdminPhone ? "ADMIN LOGIN" : "CONTINUE"}
                </button>

            </form>

        </div>
    );
}