import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";

const ADMIN_PHONE = "681731512";

export default function LoginPage() {
    const router = useRouter();

    const {
        language,
        changeLanguage,
        t,
    } = useLanguage();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("SHIPPER");

    const [vehicleType, setVehicleType] =
        useState("");

    const [plateNumber, setPlateNumber] =
        useState("");

    const [adminPin, setAdminPin] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    useEffect(() => {
        const savedRole =
            localStorage.getItem(
                "selectedRole"
            );

        if (savedRole) {
            setRole(savedRole);
        }
    }, []);

    const cleanPhone =
        phone.trim();

    const isAdminPhone =
        cleanPhone === ADMIN_PHONE;

    /*
     * ============================================================
     * CREATE SECURE SESSION
     * ============================================================
     */

    async function createSession(payload) {
        const response = await fetch(
            "/api/session/login",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",
                },

                body: JSON.stringify(
                    payload
                ),
            }
        );

        let result = null;

        try {
            result =
                await response.json();
        } catch {
            result = null;
        }

        if (!response.ok) {
            throw new Error(
                result?.error ||
                "Unable to create secure session."
            );
        }

        return result;
    }

    /*
     * ============================================================
     * LOGIN
     * ============================================================
     */

    async function handleLogin(e) {
        e.preventDefault();

        if (loading) return;

        setLoading(true);

        try {
            /*
             * ====================================================
             * ADMIN LOGIN
             * ====================================================
             */

            if (isAdminPhone) {
                if (!adminPin.trim()) {
                    alert(
                        language === "fr"
                            ? "Veuillez entrer le code PIN administrateur."
                            : "Please enter the admin PIN."
                    );

                    setLoading(false);
                    return;
                }

                const session =
                    await createSession({
                        isAdmin: true,
                        phone: cleanPhone,
                        adminPin,
                    });

                const adminUser =
                    session?.user;

                if (!adminUser) {
                    throw new Error(
                        "Administrator account could not be created."
                    );
                }

                localStorage.setItem(
                    "tayebUser",
                    JSON.stringify(
                        adminUser
                    )
                );

                localStorage.setItem(
                    "selectedRole",
                    "ADMIN"
                );

                setLoading(false);

                router.push("/admin");

                return;
            }

            /*
             * ====================================================
             * NORMAL USER VALIDATION
             * ====================================================
             */

            if (!name.trim()) {
                alert(
                    language === "fr"
                        ? "Veuillez entrer votre nom complet."
                        : "Please enter your full name."
                );

                setLoading(false);
                return;
            }

            if (!cleanPhone) {
                alert(
                    language === "fr"
                        ? "Veuillez entrer votre numéro de téléphone."
                        : "Please enter your phone number."
                );

                setLoading(false);
                return;
            }

            /*
             * ====================================================
             * DRIVER VALIDATION
             * ====================================================
             */

            if (role === "DRIVER") {
                if (!vehicleType.trim()) {
                    alert(
                        language === "fr"
                            ? "Veuillez entrer le type de véhicule."
                            : "Please enter your vehicle type."
                    );

                    setLoading(false);
                    return;
                }

                if (!plateNumber.trim()) {
                    alert(
                        language === "fr"
                            ? "Veuillez entrer le numéro de plaque."
                            : "Please enter your plate number."
                    );

                    setLoading(false);
                    return;
                }
            }

            /*
             * ====================================================
             * FIND EXISTING USER
             * ====================================================
             */

            const {
                data: existingUser,
                error: findError,
            } = await supabase
                .from("users")
                .select("*")
                .eq(
                    "phone_number",
                    cleanPhone
                )
                .maybeSingle();

            if (findError) {
                console.error(
                    "User lookup error:",
                    findError
                );

                alert(
                    findError.message
                );

                setLoading(false);
                return;
            }

            let user =
                existingUser;

            /*
             * ====================================================
             * CREATE NEW USER
             * ====================================================
             */

            if (!user) {
                const newUserData = {
                    full_name:
                        name.trim(),

                    phone_number:
                        cleanPhone,

                    role,
                };

                if (role === "DRIVER") {
                    newUserData.vehicle_type =
                        vehicleType.trim();

                    newUserData.plate_number =
                        plateNumber.trim();
                }

                const {
                    data: newUser,
                    error: createError,
                } = await supabase
                    .from("users")
                    .insert([
                        newUserData,
                    ])
                    .select()
                    .single();

                if (createError) {
                    console.error(
                        "User creation error:",
                        createError
                    );

                    alert(
                        createError.message
                    );

                    setLoading(false);
                    return;
                }

                user = newUser;
            }

            /*
             * ====================================================
             * UPDATE ROLE
             * ====================================================
             */

            if (
                user.role !== role
            ) {
                const {
                    data: updatedUser,
                    error: roleError,
                } = await supabase
                    .from("users")
                    .update({
                        role,
                    })
                    .eq(
                        "id",
                        user.id
                    )
                    .select()
                    .single();

                if (roleError) {
                    console.error(
                        "Role update error:",
                        roleError
                    );

                    alert(
                        roleError.message
                    );

                    setLoading(false);
                    return;
                }

                if (updatedUser) {
                    user =
                        updatedUser;
                }
            }

            /*
             * ====================================================
             * UPDATE DRIVER INFORMATION
             * ====================================================
             */

            if (role === "DRIVER") {
                const {
                    data: updatedDriver,
                    error: driverError,
                } = await supabase
                    .from("users")
                    .update({
                        full_name:
                            name.trim(),

                        vehicle_type:
                            vehicleType.trim(),

                        plate_number:
                            plateNumber.trim(),
                    })
                    .eq(
                        "id",
                        user.id
                    )
                    .select()
                    .single();

                if (driverError) {
                    console.error(
                        "Driver update error:",
                        driverError
                    );

                    alert(
                        driverError.message
                    );

                    setLoading(false);
                    return;
                }

                if (updatedDriver) {
                    user =
                        updatedDriver;
                }
            }

            /*
             * ====================================================
             * UPDATE SHIPPER INFORMATION
             * ====================================================
             */

            if (role === "SHIPPER") {
                const {
                    data: updatedShipper,
                    error: shipperError,
                } = await supabase
                    .from("users")
                    .update({
                        full_name:
                            name.trim(),
                    })
                    .eq(
                        "id",
                        user.id
                    )
                    .select()
                    .single();

                if (
                    !shipperError &&
                    updatedShipper
                ) {
                    user =
                        updatedShipper;
                }
            }

            /*
             * ====================================================
             * CREATE SECURE SERVER SESSION
             * ====================================================
             */

            const session =
                await createSession({
                    userId: user.id,
                    phone:
                        user.phone_number,
                });

            /*
             * Use the server-verified
             * user returned from the
             * session endpoint.
             */

            const verifiedUser =
                session?.user || user;

            /*
             * ====================================================
             * SAVE LOCAL COMPATIBILITY SESSION
             * ====================================================
             */

            localStorage.setItem(
                "tayebUser",
                JSON.stringify(
                    verifiedUser
                )
            );

            localStorage.setItem(
                "selectedRole",
                verifiedUser.role
            );

            setLoading(false);

            /*
             * ====================================================
             * ROUTING
             * ====================================================
             */

            if (
                verifiedUser.role ===
                "DRIVER"
            ) {
                router.push(
                    "/driver"
                );

                return;
            }

            router.push(
                "/shipper"
            );

        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            alert(
                error?.message ||
                (
                    language === "fr"
                        ? "Une erreur est survenue. Veuillez réessayer."
                        : "Something went wrong. Please try again."
                )
            );

            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">

            <form
                onSubmit={handleLogin}
                className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full space-y-5"
            >

                {/* BRAND */}

                <div className="text-center">

                    <div className="flex justify-center mb-3">
                        <BrandLogo size={150} />
                    </div>

                    <p className="text-orange-600 font-bold">
                        Move. Manage. Deliver.
                    </p>

                </div>

                {/* LANGUAGE */}

                <div className="flex justify-end">

                    <button
                        type="button"
                        onClick={() =>
                            changeLanguage(
                                "en"
                            )
                        }
                        className={`px-3 py-1 rounded-l-lg text-sm ${language ===
                                "en"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-200"
                            }`}
                    >
                        English
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            changeLanguage(
                                "fr"
                            )
                        }
                        className={`px-3 py-1 rounded-r-lg text-sm ${language ===
                                "fr"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-200"
                            }`}
                    >
                        Français
                    </button>

                </div>

                {/* TITLE */}

                <div>

                    <h1 className="text-3xl font-black text-center">
                        {t.welcome}
                    </h1>

                    <p className="text-center text-slate-500 text-sm mt-2">
                        {t.loginCreate}
                    </p>

                </div>

                {/* FULL NAME */}

                <input
                    type="text"
                    placeholder={
                        t.fullName
                    }
                    required={
                        !isAdminPhone
                    }
                    value={name}
                    onChange={(e) =>
                        setName(
                            e.target.value
                        )
                    }
                    disabled={
                        isAdminPhone
                    }
                    className="w-full border rounded-xl px-4 py-3 disabled:bg-gray-100"
                />

                {/* PHONE */}

                <input
                    type="text"
                    placeholder={
                        t.phone
                    }
                    required
                    value={phone}
                    onChange={(e) =>
                        setPhone(
                            e.target.value
                        )
                    }
                    className="w-full border rounded-xl px-4 py-3"
                />

                {/* ADMIN PIN */}

                {isAdminPhone && (
                    <input
                        type="password"
                        placeholder={
                            t.adminPin
                        }
                        required
                        value={adminPin}
                        onChange={(e) =>
                            setAdminPin(
                                e.target.value
                            )
                        }
                        className="w-full border rounded-xl px-4 py-3"
                    />
                )}

                {/* ROLE */}

                {!isAdminPhone && (
                    <div className="grid grid-cols-2 gap-3">

                        <button
                            type="button"
                            onClick={() => {
                                setRole(
                                    "SHIPPER"
                                );

                                localStorage.setItem(
                                    "selectedRole",
                                    "SHIPPER"
                                );
                            }}
                            className={`py-3 rounded-xl font-bold ${role ===
                                    "SHIPPER"
                                    ? "bg-orange-600 text-white"
                                    : "bg-slate-200"
                                }`}
                        >
                            {t.shipper}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setRole(
                                    "DRIVER"
                                );

                                localStorage.setItem(
                                    "selectedRole",
                                    "DRIVER"
                                );
                            }}
                            className={`py-3 rounded-xl font-bold ${role ===
                                    "DRIVER"
                                    ? "bg-orange-600 text-white"
                                    : "bg-slate-200"
                                }`}
                        >
                            {t.driver}
                        </button>

                    </div>
                )}

                {/* DRIVER INFORMATION */}

                {!isAdminPhone &&
                    role ===
                    "DRIVER" && (
                        <>
                            <input
                                type="text"
                                placeholder={
                                    t.vehicleType
                                }
                                required
                                value={
                                    vehicleType
                                }
                                onChange={(
                                    e
                                ) =>
                                    setVehicleType(
                                        e.target.value
                                    )
                                }
                                className="w-full border rounded-xl px-4 py-3"
                            />

                            <input
                                type="text"
                                placeholder={
                                    t.plateNumber
                                }
                                required
                                value={
                                    plateNumber
                                }
                                onChange={(
                                    e
                                ) =>
                                    setPlateNumber(
                                        e.target.value
                                    )
                                }
                                className="w-full border rounded-xl px-4 py-3"
                            />
                        </>
                    )}

                {/* CONTINUE */}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-amber-400 py-4 rounded-2xl font-black hover:scale-[1.02] transition disabled:opacity-60"
                >
                    {loading
                        ? t.pleaseWait
                        : isAdminPhone
                            ? t.adminLogin
                            : t.continue}
                </button>

            </form>

        </div>
    );
}