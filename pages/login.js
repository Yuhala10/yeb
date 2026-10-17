import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { apiPost } from "../lib/api";
import { CITY_NAMES } from "../lib/cities";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";

const ADMIN_PHONE = "681731512";

export default function LoginPage() {
    const router = useRouter();

    const {
        language,
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

    const [showPin, setShowPin] =
        useState(false);

    const [step, setStep] =
        useState("phone");

    const [account, setAccount] =
        useState(null);

    const [pin, setPin] =
        useState("");

    const [pinConfirm, setPinConfirm] =
        useState("");

    const [city, setCity] =
        useState("");

    const [needsVehicle, setNeedsVehicle] =
        useState(false);

    useEffect(() => {
        if (
            typeof window === "undefined"
        ) {
            return;
        }

        const savedRole =
            localStorage.getItem(
                "selectedRole"
            );

        if (
            savedRole === "SHIPPER" ||
            savedRole === "DRIVER"
        ) {
            setRole(savedRole);
        }
    }, []);

    /*
     * "+237 681 73 15 12" and "681731512" are the same number.
     */

    const cleanPhone =
        phone
            .replace(/\D/g, "")
            .replace(/^237(?=\d{9}$)/, "");

    const isAdminPhone =
        cleanPhone === ADMIN_PHONE;

    const isNewAccount =
        step === "details" &&
        account &&
        !account.exists;

    const creatingPin =
        step === "details" &&
        account &&
        (!account.exists ||
            !account.hasPin);

    const showDriverDetails =
        step === "details" &&
        role === "DRIVER" &&
        (isNewAccount ||
            needsVehicle ||
            !account?.hasVehicle);

    function text(
        key,
        english
    ) {
        try {
            return t(
                key,
                english
            );
        } catch {
            return english;
        }
    }

    function goBack() {
        router.push("/");
    }

    function selectRole(nextRole) {
        setRole(nextRole);

        if (
            typeof window !==
            "undefined"
        ) {
            localStorage.setItem(
                "selectedRole",
                nextRole
            );
        }
    }

    /*
     * ============================================================
     * ERROR MESSAGES
     * ============================================================
     *
     * The server answers in English with a code; French
     * speakers get the French version of the common ones.
     */

    function errorMessage(error) {
        const french = {
            PHONE_INVALID:
                "Entrez un numéro camerounais à 9 chiffres, comme 6XX XXX XXX.",
            PIN_INVALID:
                "Votre PIN doit contenir 4 à 6 chiffres.",
            PIN_WRONG:
                "PIN incorrect. Réessayez.",
            PIN_LOCKED:
                "Trop de PIN incorrects. Réessayez dans 15 minutes.",
            NAME_REQUIRED:
                "Veuillez entrer votre nom complet.",
            DRIVER_DETAILS_REQUIRED:
                "Ajoutez le type de véhicule et le numéro de plaque.",
            OFFLINE:
                "Pas de connexion internet. Vérifiez votre réseau.",
        };

        if (
            language === "fr" &&
            french[error?.code]
        ) {
            return french[error.code];
        }

        return (
            error?.message ||
            (language === "fr"
                ? "Une erreur est survenue. Veuillez réessayer."
                : "Something went wrong. Please try again.")
        );
    }

    /*
     * ============================================================
     * SAVE SESSION AND OPEN THE DASHBOARD
     * ============================================================
     */

    function openDashboard(user) {
        localStorage.setItem(
            "tayebUser",
            JSON.stringify(user)
        );

        localStorage.setItem(
            "selectedRole",
            user.role
        );

        if (user.role === "ADMIN") {
            router.push("/admin");
            return;
        }

        router.push(
            user.role === "DRIVER"
                ? "/driver"
                : "/shipper"
        );
    }

    function changeNumber() {
        setStep("phone");
        setAccount(null);
        setPin("");
        setPinConfirm("");
        setNeedsVehicle(false);
    }

    /*
     * ============================================================
     * LOGIN
     * ============================================================
     *
     * Step 1: the phone number tells us if this is a new or
     * returning account. Step 2: the PIN, plus name and
     * vehicle details for new accounts.
     */

    async function handleLogin(
        event
    ) {
        event.preventDefault();

        if (loading) {
            return;
        }

        setLoading(true);

        try {
            /*
             * =====================================================
             * ADMIN LOGIN
             * =====================================================
             */

            if (isAdminPhone) {
                if (!adminPin.trim()) {
                    throw new Error(
                        language === "fr"
                            ? "Veuillez entrer le code PIN administrateur."
                            : "Please enter the admin PIN."
                    );
                }

                const session =
                    await apiPost(
                        "/api/session/login",
                        {
                            isAdmin: true,
                            phone: cleanPhone,
                            adminPin,
                        }
                    );

                openDashboard(
                    session.user
                );

                return;
            }

            /*
             * =====================================================
             * STEP 1: PHONE
             * =====================================================
             */

            if (step === "phone") {
                const result =
                    await apiPost(
                        "/api/session/lookup",
                        {
                            phone,
                        }
                    );

                setAccount(result);

                /*
                 * Returning users start with the role they
                 * already have; the role cards still let
                 * them switch on purpose.
                 */

                if (
                    result.exists &&
                    (result.role === "SHIPPER" ||
                        result.role === "DRIVER")
                ) {
                    selectRole(
                        result.role
                    );
                }

                setStep("details");

                return;
            }

            /*
             * =====================================================
             * STEP 2: PIN AND DETAILS
             * =====================================================
             */

            if (!/^\d{4,6}$/.test(pin)) {
                throw new Error(
                    language === "fr"
                        ? "Votre PIN doit contenir 4 à 6 chiffres."
                        : "Your PIN must be 4 to 6 digits."
                );
            }

            if (
                creatingPin &&
                pin !== pinConfirm
            ) {
                throw new Error(
                    language === "fr"
                        ? "Les deux PIN ne sont pas identiques."
                        : "The two PINs don't match."
                );
            }

            if (
                isNewAccount &&
                !name.trim()
            ) {
                throw new Error(
                    language === "fr"
                        ? "Veuillez entrer votre nom complet."
                        : "Please enter your full name."
                );
            }

            const session =
                await apiPost(
                    "/api/session/login",
                    {
                        phone,
                        pin,
                        role,
                        name:
                            name.trim(),
                        vehicleType:
                            vehicleType.trim(),
                        plateNumber:
                            plateNumber.trim(),
                        city,
                    }
                );

            openDashboard(
                session.user
            );
        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            if (
                error?.code ===
                "DRIVER_DETAILS_REQUIRED"
            ) {
                setNeedsVehicle(true);
            }

            if (
                error?.code ===
                "PHONE_INVALID"
            ) {
                changeNumber();
            }

            alert(
                errorMessage(error)
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="tayeb-login-page">

            {/* =================================================
                BACKGROUND
            ================================================= */}

            <div className="tayeb-login-glow glow-one" />
            <div className="tayeb-login-glow glow-two" />

            {/* =================================================
                TOP NAVIGATION
            ================================================= */}

            <header className="tayeb-login-header">

                <button
                    type="button"
                    className="tayeb-back-button"
                    onClick={goBack}
                >
                    <span className="back-arrow">
                        ←
                    </span>

                    <span>
                        {text(
                            "common.back",
                            "Back"
                        )}
                    </span>
                </button>

                <BrandLogo
                    width={105}
                    height={42}
                />

                <div className="tayeb-header-space" />

            </header>


            {/* =================================================
                LOGIN CONTENT
            ================================================= */}

            <section className="tayeb-login-shell">

                <div className="tayeb-login-card">

                    {/* BRAND */}

                    <div className="tayeb-login-brand">

                        <div className="tayeb-login-logo-wrap">
                            <BrandLogo
                                width={145}
                                height={58}
                            />
                        </div>

                        <div className="tayeb-login-tagline">
                            Move. Manage. Deliver.
                        </div>

                    </div>


                    {/* TITLE */}

                    <div className="tayeb-login-heading">

                        <span className="tayeb-login-eyebrow">
                            TAYEB
                        </span>

                        <h1>
                            {text(
                                "login.welcome",
                                "Welcome to Tayeb"
                            )}
                        </h1>

                        <p>
                            {text(
                                "login.subtitle",
                                "Move your goods. Find a driver. Get moving."
                            )}
                        </p>

                    </div>


                    {/* =================================================
                        ROLE SELECTION
                    ================================================= */}

                    {!isAdminPhone && (
                        <div className="tayeb-role-section">

                            <div className="tayeb-field-label">
                                {language === "fr"
                                    ? "Je veux"
                                    : "I want to"}
                            </div>

                            <div className="tayeb-role-grid">

                                <button
                                    type="button"
                                    onClick={() =>
                                        selectRole(
                                            "SHIPPER"
                                        )
                                    }
                                    className={`tayeb-role-card ${role ===
                                            "SHIPPER"
                                            ? "selected"
                                            : ""
                                        }`}
                                >

                                    <div className="tayeb-role-icon shipper">
                                        📦
                                    </div>

                                    <div className="tayeb-role-copy">

                                        <strong>
                                            {text(
                                                "login.shipper",
                                                "Send Cargo"
                                            )}
                                        </strong>

                                        <span>
                                            {language ===
                                                "fr"
                                                ? "Envoyer mes marchandises"
                                                : "I need to move goods"}
                                        </span>

                                    </div>

                                    <div className="tayeb-role-check">
                                        {role ===
                                            "SHIPPER"
                                            ? "✓"
                                            : ""}
                                    </div>

                                </button>


                                <button
                                    type="button"
                                    onClick={() =>
                                        selectRole(
                                            "DRIVER"
                                        )
                                    }
                                    className={`tayeb-role-card ${role ===
                                            "DRIVER"
                                            ? "selected"
                                            : ""
                                        }`}
                                >

                                    <div className="tayeb-role-icon driver">
                                        🚚
                                    </div>

                                    <div className="tayeb-role-copy">

                                        <strong>
                                            {text(
                                                "login.driver",
                                                "Drive & Earn"
                                            )}
                                        </strong>

                                        <span>
                                            {language ===
                                                "fr"
                                                ? "Transporter des marchandises"
                                                : "I want to drive"}
                                        </span>

                                    </div>

                                    <div className="tayeb-role-check">
                                        {role ===
                                            "DRIVER"
                                            ? "✓"
                                            : ""}
                                    </div>

                                </button>

                            </div>

                        </div>
                    )}


                    {/* =================================================
                        FORM
                    ================================================= */}

                    <form
                        onSubmit={
                            handleLogin
                        }
                        className="tayeb-login-form"
                    >

                        {/* NAME (new accounts) */}

                        {isNewAccount && !isAdminPhone && (
                        <div className="tayeb-field">

                            <label>
                                {text(
                                    "login.fullName",
                                    "Full name"
                                )}
                            </label>

                            <div className="tayeb-input-wrap">

                                <span className="tayeb-input-icon">
                                    👤
                                </span>

                                <input
                                    type="text"
                                    value={
                                        name
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setName(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder={
                                        language ===
                                            "fr"
                                            ? "Votre nom complet"
                                            : "Your full name"
                                    }
                                    required={
                                        !isAdminPhone
                                    }
                                    disabled={
                                        isAdminPhone ||
                                        loading
                                    }
                                    autoComplete="name"
                                />

                            </div>

                        </div>
                        )}


                        {/* PHONE */}

                        <div className="tayeb-field">

                            <label>
                                {text(
                                    "login.phone",
                                    "Phone number"
                                )}
                            </label>

                            <div className="tayeb-input-wrap">

                                <span className="tayeb-input-icon">
                                    📱
                                </span>

                                <input
                                    type="tel"
                                    value={
                                        phone
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setPhone(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="6XX XXX XXX"
                                    required
                                    disabled={
                                        loading ||
                                        step ===
                                        "details"
                                    }
                                    autoComplete="tel"
                                    inputMode="tel"
                                />

                            </div>

                            {step === "details" &&
                                !isAdminPhone && (
                                    <button
                                        type="button"
                                        className="tayeb-link-button"
                                        onClick={
                                            changeNumber
                                        }
                                    >
                                        {language ===
                                            "fr"
                                            ? "Changer de numéro"
                                            : "Use another number"}
                                    </button>
                                )}

                        </div>


                        {/* USER PIN */}

                        {step === "details" &&
                            !isAdminPhone && (
                                <>
                                    <div className="tayeb-account-notice">
                                        {account?.exists
                                            ? account.hasPin
                                                ? language === "fr"
                                                    ? "👋 Bon retour ! Entrez votre PIN."
                                                    : "👋 Welcome back! Enter your PIN."
                                                : language === "fr"
                                                    ? "🔐 Créez un PIN pour protéger votre compte. Vous l'utiliserez à chaque connexion."
                                                    : "🔐 Create a PIN to protect your account. You'll use it every time you log in."
                                            : language === "fr"
                                                ? "✨ Nouveau sur Tayeb ? Créez votre compte en 1 minute."
                                                : "✨ New to Tayeb? Create your account in 1 minute."}
                                    </div>

                                    <div className="tayeb-field">

                                        <label>
                                            {creatingPin
                                                ? language === "fr"
                                                    ? "Choisissez un PIN (4 à 6 chiffres)"
                                                    : "Choose a PIN (4 to 6 digits)"
                                                : language === "fr"
                                                    ? "Votre PIN"
                                                    : "Your PIN"}
                                        </label>

                                        <div className="tayeb-input-wrap">

                                            <span className="tayeb-input-icon">
                                                🔐
                                            </span>

                                            <input
                                                type={
                                                    showPin
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={
                                                    pin
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPin(
                                                        event.target.value
                                                            .replace(/\D/g, "")
                                                            .slice(0, 6)
                                                    )
                                                }
                                                placeholder="••••"
                                                inputMode="numeric"
                                                required
                                                disabled={
                                                    loading
                                                }
                                                autoComplete={
                                                    creatingPin
                                                        ? "new-password"
                                                        : "current-password"
                                                }
                                                autoFocus
                                            />

                                            <button
                                                type="button"
                                                className="tayeb-eye-button"
                                                onClick={() =>
                                                    setShowPin(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                                tabIndex={
                                                    -1
                                                }
                                            >
                                                {showPin
                                                    ? "🙈"
                                                    : "👁️"}
                                            </button>

                                        </div>

                                    </div>

                                    {creatingPin && (
                                        <div className="tayeb-field">

                                            <label>
                                                {language === "fr"
                                                    ? "Confirmez votre PIN"
                                                    : "Confirm your PIN"}
                                            </label>

                                            <div className="tayeb-input-wrap">

                                                <span className="tayeb-input-icon">
                                                    🔐
                                                </span>

                                                <input
                                                    type={
                                                        showPin
                                                            ? "text"
                                                            : "password"
                                                    }
                                                    value={
                                                        pinConfirm
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        setPinConfirm(
                                                            event.target.value
                                                                .replace(/\D/g, "")
                                                                .slice(0, 6)
                                                        )
                                                    }
                                                    placeholder="••••"
                                                    inputMode="numeric"
                                                    required
                                                    disabled={
                                                        loading
                                                    }
                                                    autoComplete="new-password"
                                                />

                                            </div>

                                        </div>
                                    )}

                                    {!creatingPin && (
                                        <a
                                            className="tayeb-link-button"
                                            href={`https://wa.me/237${ADMIN_PHONE}?text=${encodeURIComponent(
                                                language === "fr"
                                                    ? `Bonjour Tayeb, j'ai oublié mon PIN. Mon numéro : ${cleanPhone}`
                                                    : `Hello Tayeb, I forgot my PIN. My number: ${cleanPhone}`
                                            )}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {language === "fr"
                                                ? "PIN oublié ? Écrivez-nous sur WhatsApp"
                                                : "Forgot your PIN? Message us on WhatsApp"}
                                        </a>
                                    )}
                                </>
                            )}


                        {/* ADMIN PIN */}

                        {isAdminPhone && (
                            <div className="tayeb-field">

                                <label>
                                    {text(
                                        "login.adminPin",
                                        "Admin PIN"
                                    )}
                                </label>

                                <div className="tayeb-input-wrap">

                                    <span className="tayeb-input-icon">
                                        🔐
                                    </span>

                                    <input
                                        type={
                                            showPin
                                                ? "text"
                                                : "password"
                                        }
                                        value={
                                            adminPin
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setAdminPin(
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder={
                                            language ===
                                                "fr"
                                                ? "Entrez votre PIN"
                                                : "Enter your PIN"
                                        }
                                        required
                                        disabled={
                                            loading
                                        }
                                        autoComplete="current-password"
                                    />

                                    <button
                                        type="button"
                                        className="tayeb-eye-button"
                                        onClick={() =>
                                            setShowPin(
                                                (current) =>
                                                    !current
                                            )
                                        }
                                        tabIndex={
                                            -1
                                        }
                                    >
                                        {showPin
                                            ? "🙈"
                                            : "👁️"}
                                    </button>

                                </div>

                            </div>
                        )}


                        {/* DRIVER DETAILS */}

                        {!isAdminPhone &&
                            showDriverDetails && (
                                <div className="tayeb-driver-box">

                                    <div className="tayeb-driver-heading">

                                        <div className="tayeb-driver-heading-icon">
                                            🚚
                                        </div>

                                        <div>
                                            <strong>
                                                {language ===
                                                    "fr"
                                                    ? "Informations du véhicule"
                                                    : "Vehicle information"}
                                            </strong>

                                            <span>
                                                {language ===
                                                    "fr"
                                                    ? "Aidez les expéditeurs à vous reconnaître"
                                                    : "Help shippers know what you're driving"}
                                            </span>
                                        </div>

                                    </div>


                                    <div className="tayeb-field">

                                        <label>
                                            {text(
                                                "login.vehicleType",
                                                "Vehicle type"
                                            )}
                                        </label>

                                        <div className="tayeb-input-wrap">

                                            <span className="tayeb-input-icon">
                                                🚛
                                            </span>

                                            <input
                                                type="text"
                                                value={
                                                    vehicleType
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setVehicleType(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder={
                                                    language ===
                                                        "fr"
                                                        ? "Ex. Camion, fourgon..."
                                                        : "e.g. Truck, van..."
                                                }
                                                required
                                                disabled={
                                                    loading
                                                }
                                                autoComplete="off"
                                            />

                                        </div>

                                    </div>


                                    <div className="tayeb-field">

                                        <label>
                                            {text(
                                                "login.plateNumber",
                                                "Plate number"
                                            )}
                                        </label>

                                        <div className="tayeb-input-wrap">

                                            <span className="tayeb-input-icon">
                                                🔖
                                            </span>

                                            <input
                                                type="text"
                                                value={
                                                    plateNumber
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPlateNumber(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder={
                                                    language ===
                                                        "fr"
                                                        ? "Numéro de plaque"
                                                        : "Vehicle plate number"
                                                }
                                                required
                                                disabled={
                                                    loading
                                                }
                                                autoComplete="off"
                                            />

                                        </div>

                                    </div>


                                    <div className="tayeb-field">

                                        <label>
                                            {language === "fr"
                                                ? "Votre ville (pour recevoir les marchandises près de vous)"
                                                : "Your city (to get loads near you)"}
                                        </label>

                                        <div className="tayeb-input-wrap">

                                            <span className="tayeb-input-icon">
                                                📍
                                            </span>

                                            <select
                                                value={
                                                    city
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setCity(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                disabled={
                                                    loading
                                                }
                                            >
                                                <option value="">
                                                    {language === "fr"
                                                        ? "Choisir une ville"
                                                        : "Choose a city"}
                                                </option>

                                                {CITY_NAMES.map(
                                                    (cityName) => (
                                                        <option
                                                            key={cityName}
                                                            value={cityName}
                                                        >
                                                            {cityName}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                        </div>

                                    </div>

                                </div>
                            )}


                        {/* ADMIN INDICATOR */}

                        {isAdminPhone && (
                            <div className="tayeb-admin-notice">

                                <span>
                                    🛡️
                                </span>

                                <div>
                                    <strong>
                                        {language ===
                                            "fr"
                                            ? "Accès administrateur"
                                            : "Administrator access"}
                                    </strong>

                                    <small>
                                        {language ===
                                            "fr"
                                            ? "Compte de plateforme sécurisé"
                                            : "Secure platform account"}
                                    </small>
                                </div>

                            </div>
                        )}


                        {/* SUBMIT */}

                        <button
                            type="submit"
                            disabled={
                                loading
                            }
                            className="tayeb-login-submit"
                        >

                            {loading ? (
                                <>
                                    <span className="tayeb-submit-spinner" />

                                    <span>
                                        {text(
                                            "login.pleaseWait",
                                            "Please wait..."
                                        )}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span>
                                        {isAdminPhone
                                            ? text(
                                                "login.adminLogin",
                                                "Admin Login"
                                            )
                                            : step === "phone"
                                                ? text(
                                                    "login.continue",
                                                    "Continue"
                                                )
                                                : isNewAccount
                                                    ? language === "fr"
                                                        ? "Créer mon compte"
                                                        : "Create my account"
                                                    : language === "fr"
                                                        ? "Se connecter"
                                                        : "Log in"}
                                    </span>

                                    <span className="submit-arrow">
                                        →
                                    </span>
                                </>
                            )}

                        </button>

                    </form>


                    {/* SECURITY NOTE */}

                    <div className="tayeb-login-security">

                        <span>
                            🔒
                        </span>

                        <span>
                            {language ===
                                "fr"
                                ? "Votre session est sécurisée."
                                : "Your session is secure."}
                        </span>

                    </div>

                </div>

            </section>


            {/* =================================================
                FOOTER
            ================================================= */}

            <footer className="tayeb-login-footer">

                <BrandLogo
                    width={82}
                    height={32}
                />

                <span>
                    Move. Manage. Deliver.
                </span>

            </footer>


            {/* =================================================
                PREMIUM STYLES
            ================================================= */}

            <style jsx global>{`

                * {
                    box-sizing: border-box;
                }


                body {
                    margin: 0;
                    background: #f8fafc;
                }


                .tayeb-login-page {
                    position: relative;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background:
                        radial-gradient(
                            circle at 12% 15%,
                            rgba(249,115,22,0.09),
                            transparent 32%
                        ),
                        radial-gradient(
                            circle at 88% 82%,
                            rgba(251,191,36,0.08),
                            transparent 30%
                        ),
                        #f8fafc;
                    color: #111827;
                }


                .tayeb-login-glow {
                    position: fixed;
                    z-index: 0;
                    pointer-events: none;
                    border-radius: 999px;
                    filter: blur(80px);
                    opacity: 0.55;
                }


                .glow-one {
                    width: 320px;
                    height: 320px;
                    left: -170px;
                    top: 150px;
                    background: #fed7aa;
                }


                .glow-two {
                    width: 300px;
                    height: 300px;
                    right: -150px;
                    bottom: 60px;
                    background: #fde68a;
                }


                /* =================================================
                   HEADER
                ================================================= */

                .tayeb-login-header {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    min-height: 72px;
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: center;
                    padding: 12px clamp(16px, 5vw, 65px);
                    background: rgba(
                        255,
                        255,
                        255,
                        0.82
                    );
                    border-bottom: 1px solid
                        rgba(
                            229,
                            231,
                            235,
                            0.85
                        );
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                }


                .tayeb-back-button {
                    justify-self: start;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 40px;
                    padding: 0 13px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    background: white;
                    color: #374151;
                    font-size: 9px;
                    font-weight: 900;
                    cursor: pointer;
                    transition:
                        0.18s ease;
                }


                .tayeb-back-button:hover {
                    color: #ea580c;
                    border-color: #fed7aa;
                    background: #fff7ed;
                    transform:
                        translateX(-2px);
                }


                .back-arrow {
                    font-size: 15px;
                    line-height: 1;
                }


                .tayeb-header-space {
                    justify-self: end;
                    width: 70px;
                }


                /* =================================================
                   SHELL
                ================================================= */

                .tayeb-login-shell {
                    position: relative;
                    z-index: 2;
                    flex: 1;
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    padding:
                        48px 18px 55px;
                }


                .tayeb-login-card {
                    width: min(
                        500px,
                        100%
                    );
                    align-self: flex-start;
                    padding:
                        34px;
                    border: 1px solid
                        rgba(
                            229,
                            231,
                            235,
                            0.95
                        );
                    border-radius: 32px;
                    background:
                        rgba(
                            255,
                            255,
                            255,
                            0.96
                        );
                    box-shadow:
                        0 35px 90px
                            rgba(
                                15,
                                23,
                                42,
                                0.10
                            ),
                        0 8px 30px
                            rgba(
                                15,
                                23,
                                42,
                                0.04
                            );
                }


                /* =================================================
                   BRAND
                ================================================= */

                .tayeb-login-brand {
                    text-align: center;
                }


                .tayeb-login-logo-wrap {
                    display: flex;
                    justify-content: center;
                }


                .tayeb-login-tagline {
                    margin-top: 2px;
                    color: #f97316;
                    font-size: 8px;
                    font-weight: 900;
                    letter-spacing:
                        0.13em;
                    text-transform:
                        uppercase;
                }


                /* =================================================
                   HEADING
                ================================================= */

                .tayeb-login-heading {
                    margin-top: 28px;
                    text-align: center;
                }


                .tayeb-login-eyebrow {
                    display: inline-flex;
                    align-items: center;
                    min-height: 24px;
                    padding: 0 9px;
                    border-radius: 999px;
                    background: #fff7ed;
                    border: 1px solid
                        #fed7aa;
                    color: #ea580c;
                    font-size: 7px;
                    font-weight: 900;
                    letter-spacing:
                        0.15em;
                }


                .tayeb-login-heading h1 {
                    margin:
                        12px 0 0;
                    color: #111827;
                    font-size:
                        clamp(
                            29px,
                            7vw,
                            39px
                        );
                    line-height: 1;
                    letter-spacing:
                        -0.055em;
                    font-weight: 950;
                }


                .tayeb-login-heading p {
                    max-width: 370px;
                    margin:
                        12px auto 0;
                    color: #6b7280;
                    font-size: 11px;
                    line-height: 1.6;
                }


                /* =================================================
                   ROLE SELECTION
                ================================================= */

                .tayeb-role-section {
                    margin-top: 29px;
                }


                .tayeb-field-label {
                    margin-bottom: 9px;
                    color: #374151;
                    font-size: 8px;
                    font-weight: 900;
                    text-transform:
                        uppercase;
                    letter-spacing:
                        0.08em;
                }


                .tayeb-role-grid {
                    display: grid;
                    grid-template-columns:
                        repeat(
                            2,
                            minmax(0, 1fr)
                        );
                    gap: 10px;
                }


                .tayeb-role-card {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    min-height: 78px;
                    padding:
                        12px;
                    border: 1px solid
                        #e5e7eb;
                    border-radius: 19px;
                    background: #fff;
                    color: #374151;
                    text-align: left;
                    cursor: pointer;
                    transition:
                        0.18s ease;
                }


                .tayeb-role-card:hover {
                    border-color:
                        #fed7aa;
                    transform:
                        translateY(-1px);
                    box-shadow:
                        0 8px 20px
                            rgba(
                                249,
                                115,
                                22,
                                0.07
                            );
                }


                .tayeb-role-card.selected {
                    border-color:
                        #f97316;
                    background:
                        #fffaf5;
                    box-shadow:
                        0 10px 25px
                            rgba(
                                249,
                                115,
                                22,
                                0.10
                            );
                }


                .tayeb-role-icon {
                    width: 42px;
                    height: 42px;
                    flex: 0 0 42px;
                    display: grid;
                    place-items: center;
                    border-radius: 13px;
                    font-size: 19px;
                }


                .tayeb-role-icon.shipper {
                    background:
                        #fff7ed;
                }


                .tayeb-role-icon.driver {
                    background:
                        #f8fafc;
                }


                .tayeb-role-copy {
                    min-width: 0;
                    flex: 1;
                }


                .tayeb-role-copy strong {
                    display: block;
                    color: #111827;
                    font-size: 9px;
                    font-weight: 950;
                }


                .tayeb-role-copy span {
                    display: block;
                    margin-top: 4px;
                    color: #9ca3af;
                    font-size: 7px;
                    line-height: 1.3;
                }


                .tayeb-role-check {
                    width: 20px;
                    height: 20px;
                    flex: 0 0 20px;
                    display: grid;
                    place-items: center;
                    border: 1px solid
                        #e5e7eb;
                    border-radius: 50%;
                    color: white;
                    background:
                        white;
                    font-size: 10px;
                    font-weight: 900;
                }


                .tayeb-role-card.selected
                    .tayeb-role-check {
                    border-color:
                        #f97316;
                    background:
                        #f97316;
                }


                /* =================================================
                   FORM
                ================================================= */

                .tayeb-login-form {
                    display: grid;
                    gap: 17px;
                    margin-top: 25px;
                }


                .tayeb-field {
                    display: grid;
                    gap: 7px;
                }


                .tayeb-field label {
                    color: #374151;
                    font-size: 12px;
                    font-weight: 800;
                }


                .tayeb-link-button {
                    justify-self: start;
                    padding: 2px 0;
                    border: 0;
                    background: transparent;
                    color: #ea580c;
                    font-family: inherit;
                    font-size: 12px;
                    font-weight: 800;
                    text-decoration: none;
                    cursor: pointer;
                }


                .tayeb-account-notice {
                    padding: 12px 14px;
                    border-radius: 14px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    color: #9a3412;
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1.45;
                }


                .tayeb-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }


                .tayeb-input-icon {
                    position: absolute;
                    left: 14px;
                    z-index: 2;
                    font-size: 13px;
                    pointer-events: none;
                }


                .tayeb-input-wrap input,
                .tayeb-input-wrap select {
                    width: 100%;
                    min-height: 53px;
                    padding:
                        0 43px;
                    border: 1px solid
                        #e5e7eb;
                    border-radius: 15px;
                    outline: none;
                    background: #f9fafb;
                    color: #111827;
                    font-family: inherit;
                    /* 16px stops iPhones zooming in on focus. */
                    font-size: 16px;
                    font-weight: 650;
                    transition:
                        0.18s ease;
                }


                .tayeb-input-wrap select {
                    appearance: none;
                    -webkit-appearance: none;
                    cursor: pointer;
                }


                .tayeb-input-wrap input::placeholder {
                    color: #b0b7c3;
                    font-weight: 500;
                }


                .tayeb-input-wrap input:hover,
                .tayeb-input-wrap select:hover {
                    border-color:
                        #d1d5db;
                    background: #fff;
                }


                .tayeb-input-wrap select:focus,
                .tayeb-input-wrap input:focus {
                    border-color:
                        #f97316;
                    background: white;
                    box-shadow:
                        0 0 0 4px
                            rgba(
                                249,
                                115,
                                22,
                                0.09
                            );
                }


                .tayeb-input-wrap input:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }


                .tayeb-eye-button {
                    position: absolute;
                    right: 10px;
                    width: 34px;
                    height: 34px;
                    display: grid;
                    place-items: center;
                    border: 0;
                    border-radius: 9px;
                    background:
                        transparent;
                    cursor: pointer;
                    font-size: 13px;
                }


                .tayeb-eye-button:hover {
                    background:
                        #f3f4f6;
                }


                /* =================================================
                   DRIVER
                ================================================= */

                .tayeb-driver-box {
                    display: grid;
                    gap: 16px;
                    padding:
                        18px;
                    border: 1px solid
                        #fed7aa;
                    border-radius: 20px;
                    background:
                        linear-gradient(
                            135deg,
                            #fffaf5,
                            #ffffff
                        );
                }


                .tayeb-driver-heading {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }


                .tayeb-driver-heading-icon {
                    width: 38px;
                    height: 38px;
                    flex: 0 0 38px;
                    display: grid;
                    place-items: center;
                    border-radius: 12px;
                    background:
                        #fff7ed;
                    font-size: 17px;
                }


                .tayeb-driver-heading strong {
                    display: block;
                    color: #111827;
                    font-size: 9px;
                    font-weight: 950;
                }


                .tayeb-driver-heading span {
                    display: block;
                    margin-top: 3px;
                    color: #9ca3af;
                    font-size: 7px;
                    line-height: 1.4;
                }


                /* =================================================
                   ADMIN
                ================================================= */

                .tayeb-admin-notice {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding:
                        13px 15px;
                    border: 1px solid
                        #e5e7eb;
                    border-radius: 15px;
                    background:
                        #f8fafc;
                }


                .tayeb-admin-notice > span {
                    width: 34px;
                    height: 34px;
                    display: grid;
                    place-items: center;
                    border-radius: 10px;
                    background:
                        #eef2ff;
                }


                .tayeb-admin-notice strong {
                    display: block;
                    color: #374151;
                    font-size: 8px;
                    font-weight: 900;
                }


                .tayeb-admin-notice small {
                    display: block;
                    margin-top: 3px;
                    color: #9ca3af;
                    font-size: 7px;
                }


                /* =================================================
                   SUBMIT
                ================================================= */

                .tayeb-login-submit {
                    position: relative;
                    width: 100%;
                    min-height: 58px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 3px;
                    padding: 0 20px;
                    border: 1px solid
                        #ea580c;
                    border-radius: 17px;
                    background:
                        linear-gradient(
                            135deg,
                            #f97316,
                            #ea580c
                        );
                    color: white;
                    font-family: inherit;
                    font-size: 10px;
                    font-weight: 950;
                    letter-spacing:
                        0.01em;
                    cursor: pointer;
                    box-shadow:
                        0 14px 30px
                            rgba(
                                249,
                                115,
                                22,
                                0.22
                            );
                    transition:
                        0.18s ease;
                }


                .tayeb-login-submit:hover:not(:disabled) {
                    transform:
                        translateY(-2px);
                    box-shadow:
                        0 18px 35px
                            rgba(
                                249,
                                115,
                                22,
                                0.28
                            );
                }


                .tayeb-login-submit:active:not(:disabled) {
                    transform:
                        translateY(0);
                }


                .tayeb-login-submit:disabled {
                    opacity: 0.72;
                    cursor: not-allowed;
                    box-shadow: none;
                }


                .submit-arrow {
                    font-size: 16px;
                    line-height: 1;
                }


                .tayeb-submit-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid
                        rgba(
                            255,
                            255,
                            255,
                            0.35
                        );
                    border-top-color:
                        white;
                    border-radius: 50%;
                    animation:
                        tayebLoginSpin
                        0.7s linear
                        infinite;
                }


                @keyframes tayebLoginSpin {
                    to {
                        transform:
                            rotate(360deg);
                    }
                }


                /* =================================================
                   SECURITY
                ================================================= */

                .tayeb-login-security {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    margin-top: 18px;
                    color: #9ca3af;
                    font-size: 7px;
                    font-weight: 700;
                }


                /* =================================================
                   FOOTER
                ================================================= */

                .tayeb-login-footer {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    padding:
                        0 18px 25px;
                    color: #9ca3af;
                    font-size: 7px;
                    font-weight: 800;
                }


                /* =================================================
                   MOBILE
                ================================================= */

                @media (max-width: 600px) {

                    .tayeb-login-header {
                        min-height: 64px;
                        padding:
                            10px 13px;
                    }


                    .tayeb-back-button {
                        min-height: 37px;
                        padding:
                            0 10px;
                    }


                    .tayeb-login-shell {
                        padding:
                            22px 12px 40px;
                    }


                    .tayeb-login-card {
                        padding:
                            25px 18px;
                        border-radius:
                            27px;
                    }


                    .tayeb-login-heading {
                        margin-top:
                            22px;
                    }


                    .tayeb-login-heading h1 {
                        font-size:
                            31px;
                    }


                    .tayeb-role-grid {
                        grid-template-columns:
                            1fr;
                    }


                    .tayeb-role-card {
                        min-height:
                            70px;
                    }


                    .tayeb-input-wrap input {
                        min-height:
                            51px;
                    }


                    .tayeb-login-submit {
                        min-height:
                            56px;
                    }

                }


                @media (max-width: 380px) {

                    .tayeb-login-card {
                        padding:
                            22px 14px;
                    }


                    .tayeb-login-heading h1 {
                        font-size:
                            28px;
                    }

                }

            `}</style>

        </main>
    );
}