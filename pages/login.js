import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import PhoneInput from "../components/Site/PhoneInput";
import ThemeToggle from "../components/Site/ThemeToggle";
import { apiGet, apiPost } from "../lib/api";
import { appError, useAppText } from "../lib/appText";
import { cityNames } from "../lib/cities";
import { FOUNDER, QUOTES } from "../lib/founder";
import { useLanguage } from "../lib/LanguageContext";
import { formatPhone, parsePhone } from "../lib/phone";
import { useVisitorCountry } from "../lib/useCountry";
import { DASHBOARDS } from "../lib/useSession";

/*
 * ============================================================
 * LOGIN AND SIGN-UP
 * ============================================================
 *
 * Step 1: what you want to do and your phone number. The
 * server says if the number is new, has a PIN, or needs one.
 * Step 2: the PIN, plus name and vehicle/farm details for new
 * accounts. Then back to the page that sent you here, or to
 * your dashboard.
 */

const ROLES = [
    ["SHIPPER", "📦"],
    ["DRIVER", "🚚"],
    ["FARMER", "🌾"],
];

const ROLE_KEYS = ROLES.map(([key]) => key);

export default function LoginPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const a = useAppText();

    const [country, setCountry] = useVisitorCountry();

    const [step, setStep] = useState("phone");

    const [role, setRole] = useState("SHIPPER");

    const [switching, setSwitching] = useState(false);

    const [phone, setPhone] = useState("");

    const [account, setAccount] = useState(null);

    const [name, setName] = useState("");

    const [pin, setPin] = useState("");

    const [pinRepeat, setPinRepeat] = useState("");

    const [showPin, setShowPin] = useState(false);

    const [vehicleType, setVehicleType] = useState("");

    const [plate, setPlate] = useState("");

    const [city, setCity] = useState("");

    const [needsVehicle, setNeedsVehicle] = useState(false);

    const [marketOpen, setMarketOpen] = useState(false);

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    /* ---------------- setup ---------------- */

    useEffect(() => {
        let alive = true;

        apiGet("/api/market?status=1")
            .then((result) => alive && setMarketOpen(Boolean(result.ready)))
            .catch(() => {});

        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!router.isReady) {
            return;
        }

        // Deferred so the first render matches the server's.
        const timer = setTimeout(() => {
            const fromLink = String(router.query.role || "").toUpperCase();

            let saved = null;

            try {
                saved = localStorage.getItem("selectedRole");
            } catch {
                saved = null;
            }

            const next = ROLE_KEYS.includes(fromLink) ? fromLink : ROLE_KEYS.includes(saved) ? saved : null;

            if (next) {
                setRole(next);
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [router.isReady, router.query.role]);

    /* ---------------- derived ---------------- */

    const isNew = step === "pin" && account && !account.exists;

    const creatingPin = step === "pin" && account && (!account.exists || !account.hasPin);

    const askVehicle = step === "pin" && role === "DRIVER" && (isNew || needsVehicle || !account?.hasVehicle);

    const askFarm = step === "pin" && role === "FARMER" && (isNew || !account?.hasCity);

    const roles = ROLES.filter(([key]) => key !== "FARMER" || marketOpen || role === "FARMER");

    function chooseRole(next) {
        setRole(next);
        setError("");

        try {
            localStorage.setItem("selectedRole", next);
        } catch {
            // Storage blocked: the choice still counts for this login.
        }
    }

    function restart() {
        setStep("phone");
        setAccount(null);
        setPin("");
        setPinRepeat("");
        setNeedsVehicle(false);
        setSwitching(false);
        setError("");
    }

    function openDashboard(user) {
        try {
            localStorage.setItem("tayebUser", JSON.stringify(user));
            localStorage.setItem("selectedRole", user.role);
        } catch {
            // Storage blocked: the session cookie is what counts.
        }

        let returnTo = null;

        try {
            returnTo = localStorage.getItem("tayebReturnTo");
            localStorage.removeItem("tayebReturnTo");
        } catch {
            returnTo = null;
        }

        // Back to the page that sent them here, if it's on this site.
        if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")) {
            router.push(returnTo);
            return;
        }

        router.push(DASHBOARDS[user.role] || "/");
    }

    /* ---------------- submit ---------------- */

    async function submit(event) {
        event.preventDefault();

        if (loading) {
            return;
        }

        setError("");
        setLoading(true);

        try {
            if (step === "phone") {
                const result = await apiPost("/api/session/lookup", { phone, country });

                setAccount(result);

                if (result.country) {
                    setCountry(result.country);
                }

                // Returning people start in the space they already use.
                if (result.exists && ROLE_KEYS.includes(result.role)) {
                    setRole(result.role);
                }

                setStep("pin");
                return;
            }

            if (!/^\d{4,6}$/.test(pin)) {
                throw new Error(a("l_pinShort"));
            }

            if (creatingPin && pin !== pinRepeat) {
                throw new Error(a("l_pinMismatch"));
            }

            if (isNew && name.trim().length < 2) {
                throw new Error(a("l_nameMissing"));
            }

            const session = await apiPost("/api/session/login", {
                phone,
                country,
                pin,
                role,
                name: name.trim(),
                vehicleType: vehicleType.trim(),
                plateNumber: plate.trim(),
                city,
            });

            openDashboard(session.user);
        } catch (failure) {
            if (failure?.code === "DRIVER_DETAILS_REQUIRED") {
                setNeedsVehicle(true);
            }

            if (failure?.code === "PHONE_INVALID") {
                restart();
            }

            setError(appError(language, failure));
        } finally {
            setLoading(false);
        }
    }

    const quote = QUOTES[0];

    const forgot = `https://wa.me/${FOUNDER.whatsapp}?text=${encodeURIComponent(a("l_forgotMessage", { phone: phone.trim() }))}`;

    return (
        <>
            <Head>
                <title>{`${a("l_title")} · Tayeb`}</title>
                <meta name="description" content={a("l_sub")} />
                <meta name="robots" content="noindex, follow" />
            </Head>

            <main className="lg-page">

                {/* =============================================
                    STORY
                ============================================= */}

                <section className="lg-story">

                    <div className="lg-top">
                        <Link href="/" className="ts-brand" aria-label="Tayeb">
                            <span className="ts-brand-logo">
                                <Image src="/branding/tayeb-logo.jpeg" alt="" width={40} height={40} priority />
                            </span>
                            <span className="ts-brand-name">Tayeb</span>
                        </Link>
                        <div style={{ display: "flex", gap: 8 }}>
                            <ThemeToggle onDark />
                            <Link href="/" className="lg-back">← {a("l_back")}</Link>
                        </div>
                    </div>

                    <div>
                        <h1>
                            {language === "fr" ? <>Bienvenue sur <em>Tayeb</em>.</> : <>Welcome to <em>Tayeb</em>.</>}
                        </h1>
                        <p>{a("l_sub")}</p>
                        <ul className="lg-perks">
                            {["l_perk1", "l_perk2", "l_perk3"].map((key) => (
                                <li key={key}><span aria-hidden="true">✓</span>{a(key)}</li>
                            ))}
                        </ul>
                    </div>

                    <blockquote className="lg-quote">
                        “{quote.text[language] || quote.text.en}”
                        <strong>{quote.author}</strong>
                    </blockquote>

                </section>


                {/* =============================================
                    FORM
                ============================================= */}

                <section className="lg-panel">
                    <form className="lg-card" onSubmit={submit} noValidate>

                        <div className="lg-steps" aria-hidden="true">
                            <i className="on" />
                            <i className={step === "pin" ? "on" : ""} />
                        </div>

                        <h2>
                            {step === "phone"
                                ? a("l_iWant")
                                : account?.exists
                                    ? a("l_welcomeBack").split("!")[0] + " 👋"
                                    : a("l_create")}
                        </h2>

                        {/* ---------- role ---------- */}

                        {(step === "phone" || switching) && (
                            <div className="lg-roles" role="radiogroup" aria-label={a("l_iWant")}>
                                {roles.map(([key, icon]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        role="radio"
                                        aria-checked={role === key}
                                        className={`lg-role ${role === key ? "active" : ""}`}
                                        onClick={() => {
                                            chooseRole(key);
                                            setSwitching(false);
                                        }}
                                    >
                                        <span aria-hidden="true">{icon}</span>
                                        <span>
                                            <strong>{a(`l_${key}`)}</strong>
                                            <small>{a(`l_${key}_sub`)}</small>
                                        </span>
                                        <i aria-hidden="true">{role === key ? "✓" : ""}</i>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ---------- phone ---------- */}

                        {step === "phone" ? (
                            <div className="ap-field">
                                <label htmlFor="login-phone">{a("l_phone")}</label>
                                <PhoneInput
                                    id="login-phone"
                                    country={country}
                                    onCountry={setCountry}
                                    value={phone}
                                    onChange={setPhone}
                                    disabled={loading}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="lg-who">
                                    <div>
                                        <small className="ap-label">{a("l_phone")}</small>
                                        <div><strong>{formatPhone(parsePhone(phone, country)?.phone || phone)}</strong></div>
                                    </div>
                                    <button type="button" className="lg-link" onClick={restart}>{a("l_change")}</button>
                                </div>

                                {!switching && (
                                    <div className="lg-who">
                                        <div>
                                            <small className="ap-label">{a("l_iWant")}</small>
                                            <div><strong>{ROLES.find(([key]) => key === role)?.[1]} {a(`l_${role}`)}</strong></div>
                                        </div>
                                        {roles.length > 1 && (
                                            <button type="button" className="lg-link" onClick={() => setSwitching(true)}>
                                                {language === "fr" ? "Changer" : "Change"}
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className={`ap-note ${account?.exists ? "ap-note-green" : "ap-note-orange"}`}>
                                    <span aria-hidden="true">{account?.exists ? (account.hasPin ? "👋" : "🔐") : "✨"}</span>
                                    <span>{account?.exists ? (account.hasPin ? a("l_welcomeBack") : a("l_setPin")) : a("l_new")}</span>
                                </div>
                            </>
                        )}

                        {/* ---------- new account: name ---------- */}

                        {isNew && (
                            <div className="ap-field">
                                <label htmlFor="login-name">{a("l_name")}</label>
                                <input
                                    id="login-name"
                                    className="mk-input"
                                    value={name}
                                    maxLength={80}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder={a("l_namePlaceholder")}
                                    autoComplete="name"
                                    autoFocus
                                />
                            </div>
                        )}

                        {/* ---------- driver: vehicle ---------- */}

                        {askVehicle && (
                            <div className="ap-card is-muted" style={{ padding: 16 }}>
                                <div>
                                    <strong style={{ color: "var(--ts-ink)" }}>🚚 {a("l_vehicle")}</strong>
                                    <div className="ap-card-sub">{a("l_vehicleSub")}</div>
                                </div>
                                <div className="ap-field">
                                    <label htmlFor="login-vehicle">{a("l_vehicleType")}</label>
                                    <input
                                        id="login-vehicle"
                                        className="mk-input"
                                        value={vehicleType}
                                        maxLength={60}
                                        onChange={(event) => setVehicleType(event.target.value)}
                                        placeholder={a("l_vehicleTypePlaceholder")}
                                        autoComplete="off"
                                    />
                                    <div className="ap-chips">
                                        {a("l_vehicles").split("|").map((choice) => (
                                            <button
                                                key={choice}
                                                type="button"
                                                className={`ap-chip ${vehicleType === choice ? "ap-chip-orange" : ""}`}
                                                style={{ border: 0, cursor: "pointer" }}
                                                onClick={() => setVehicleType(choice)}
                                            >
                                                {choice}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="ap-form-grid">
                                    <div className="ap-field">
                                        <label htmlFor="login-plate">{a("l_plate")}</label>
                                        <input
                                            id="login-plate"
                                            className="mk-input"
                                            value={plate}
                                            maxLength={20}
                                            onChange={(event) => setPlate(event.target.value.toUpperCase())}
                                            placeholder={a("l_platePlaceholder")}
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="ap-field">
                                        <label htmlFor="login-city">{a("l_city")}</label>
                                        <select id="login-city" className="mk-select" value={city} onChange={(event) => setCity(event.target.value)}>
                                            <option value="">{a("l_chooseCity")}</option>
                                            {cityNames(country).map((item) => (
                                                <option key={item} value={item}>{item}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <small className="ap-card-sub">{a("l_cityHint")}</small>
                            </div>
                        )}

                        {/* ---------- farmer: farm city ---------- */}

                        {askFarm && (
                            <div className="ap-card is-muted" style={{ padding: 16 }}>
                                <div>
                                    <strong style={{ color: "var(--ts-ink)" }}>🌾 {a("l_farm")}</strong>
                                    <div className="ap-card-sub">{a("l_farmSub")}</div>
                                </div>
                                <div className="ap-field">
                                    <label htmlFor="login-farm">{a("l_farmCity")}</label>
                                    <select id="login-farm" className="mk-select" value={city} onChange={(event) => setCity(event.target.value)}>
                                        <option value="">{a("l_chooseCity")}</option>
                                        {cityNames(country).map((item) => (
                                            <option key={item} value={item}>{item}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* ---------- PIN ---------- */}

                        {step === "pin" && (
                            <>
                                <div className="ap-field">
                                    <label htmlFor="login-pin">{creatingPin ? a("l_pinNew") : a("l_pin")}</label>
                                    <div className="lg-pin">
                                        <input
                                            id="login-pin"
                                            className="mk-input ap-pin"
                                            type={showPin ? "text" : "password"}
                                            inputMode="numeric"
                                            value={pin}
                                            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="••••"
                                            autoComplete={creatingPin ? "new-password" : "current-password"}
                                            autoFocus={!isNew}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPin((current) => !current)}
                                            aria-label={showPin ? a("l_hidePin") : a("l_showPin")}
                                            tabIndex={-1}
                                        >
                                            {showPin ? "🙈" : "👁️"}
                                        </button>
                                    </div>
                                </div>

                                {creatingPin && (
                                    <div className="ap-field">
                                        <label htmlFor="login-pin-repeat">{a("l_pinRepeat")}</label>
                                        <input
                                            id="login-pin-repeat"
                                            className="mk-input ap-pin"
                                            type={showPin ? "text" : "password"}
                                            inputMode="numeric"
                                            value={pinRepeat}
                                            onChange={(event) => setPinRepeat(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                            placeholder="••••"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                )}

                                {!creatingPin && (
                                    <a className="lg-link" href={forgot} target="_blank" rel="noopener noreferrer">
                                        {a("l_forgot")}
                                    </a>
                                )}
                            </>
                        )}

                        {error && (
                            <div className="ap-note ap-note-red" role="alert">
                                <span aria-hidden="true">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={loading}>
                            {loading ? a("l_wait") : step === "phone" ? `${a("l_continue")} →` : isNew ? `${a("l_create")} →` : `${a("l_login")} →`}
                        </button>

                        <div className="lg-secure">
                            <span aria-hidden="true">🔒</span>
                            <span>{a("l_secure")}</span>
                        </div>

                    </form>
                </section>

            </main>
        </>
    );
}
