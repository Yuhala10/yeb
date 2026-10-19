import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CodeDigits, Stars } from "../components/App/Bits";
import { useFeedback } from "../components/App/Feedback";
import PhoneInput from "../components/Site/PhoneInput";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { CARGO_TYPES, cargoLabel } from "../lib/cargo";
import { cityNames, findCity, nearestCity } from "../lib/cities";
import { VEHICLE_CLASSES, fareFor, inCameroon, vehicleClass } from "../lib/fleet";
import { goDuration, goError, useGoText } from "../lib/goText";
import { useLanguage } from "../lib/LanguageContext";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref, whatsappHref } from "../lib/phone";
import { useMapPadding } from "../lib/useMapPadding";
import { loginThenReturn, useSession } from "../lib/useSession";

/*
 * ============================================================
 * TAYEB GO: ORDER A DELIVERY (customer)
 * ============================================================
 *
 * Like a ride app, for goods. The map fills the screen; a
 * sheet at the bottom (a panel on the left on computers)
 * walks through it:
 *
 *   plan     where from, where to (search, my position, or a
 *            pin you move the map under), vehicle with its
 *            fixed price and how soon the nearest driver is
 *            there, what you send, receiver, payment;
 *   trip     searching (radar), driver on the way (live car),
 *            at the pickup, on the road, arrived, delivered
 *            (rating), or cancelled.
 *
 * /go?trip=<id> opens one trip; /go resumes the trip in
 * progress, if any.
 */

const GoMap = dynamic(() => import("../components/Map/GoMap"), { ssr: false });

const DEFAULT_CENTER = { lat: 4.0511, lng: 9.7679 };

const RECENT_KEY = "tayebGoRecent";

function readRecent() {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");

        return Array.isArray(list) ? list.filter((item) => item && inCameroon(item) && item.label).slice(0, 6) : [];
    } catch {
        return [];
    }
}

function saveRecent(places) {
    try {
        const list = [...places, ...readRecent()].filter(
            (item, index, all) => item && item.label && all.findIndex((other) => other.label === item.label) === index
        );

        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6).map(({ label, lat, lng }) => ({ label, lat, lng }))));
    } catch {
        // Storage blocked: nothing to remember.
    }
}

function locateOnce() {
    return new Promise((resolve, reject) => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
            reject(new Error("unsupported"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (fix) => resolve({ lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy }),
            (error) => reject(error),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
    });
}

function trackLink(trip, language) {
    if (typeof window === "undefined" || !trip?.track_token) {
        return "";
    }

    return `${window.location.origin}${language === "en" ? "/en" : ""}/track/${trip.id}?t=${trip.track_token}`;
}

export default function GoPage() {
    const router = useRouter();

    const { language } = useLanguage();

    const g = useGoText();

    const { toast, confirm } = useFeedback();

    const session = useSession();

    const user = session.user;

    // The sheet element (a callback ref: it appears after loading).
    const [sheetElement, setSheetElement] = useState(null);

    const sheet = setSheetElement;

    const padding = useMapPadding(sheetElement);

    /* ---------------- trip or plan ---------------- */

    // { ready, tripId } from the server, for /go without a trip.
    const [mine, setMine] = useState(null);

    const queryTrip = typeof router.query.trip === "string" ? router.query.trip : null;

    const tripId = queryTrip;

    // After "new delivery", don't jump back to the last trip.
    const [fresh, setFresh] = useState(false);

    // Not signed in: log in as a sender, then come back here.
    useEffect(() => {
        if (session.loading) {
            return;
        }

        if (!user) {
            loginThenReturn(router, "SHIPPER", "/go");
        }
        // Once the session is known.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.loading, user]);

    useEffect(() => {
        if (!router.isReady || !user || user.role !== "SHIPPER" || queryTrip || mine) {
            return;
        }

        apiGet("/api/go?mine=1")
            .then((result) => {
                setMine({ ready: Boolean(result.ready), tripId: result.tripId || null });

                if (result.tripId && !fresh) {
                    router.replace(`/go?trip=${result.tripId}`, undefined, { shallow: true });
                }
            })
            .catch(() => setMine({ ready: false, tripId: null }));
        // When the person or the address changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, user, queryTrip]);

    /* ---------------- map state ---------------- */

    const [focus, setFocus] = useState(null);

    const [fitKey, setFitKey] = useState(0);

    const [cars, setCars] = useState([]);

    const [me, setMe] = useState(null);

    const focusOn = useCallback((point, options = {}) => {
        setFocus({ lat: point.lat, lng: point.lng, zoom: options.zoom, pick: Boolean(options.pick), key: Date.now() + Math.random() });
    }, []);

    /* ---------------- what to show ---------------- */

    if (session.loading || (user && user.role === "SHIPPER" && !tripId && mine === null)) {
        return <GoLoading />;
    }

    if (!user) {
        return <GoLoading />;
    }

    if (user.role !== "SHIPPER") {
        return (
            <GoMessage
                icon="🚚"
                title={g("brand")}
                text={language === "fr" ? "Tayeb Go sert à envoyer des marchandises. Connectez-vous avec un compte expéditeur." : "Tayeb Go is for sending goods. Log in with a sender account."}
                href={user.role === "DRIVER" ? "/drive" : "/"}
                label={user.role === "DRIVER" ? g("drv_title") : g("back")}
            />
        );
    }

    if (!tripId && !mine?.ready) {
        return <GoMessage icon="⚡" title={g("notReady")} text={g("notReadyText")} href="/shipper" label={g("postLoad")} />;
    }

    return (
        <>
            <Head>
                <title>{`${g("brand")} · Tayeb`}</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="go-page">
                <GoScreen
                    key={tripId || "plan"}
                    user={user}
                    tripId={tripId}
                    sheet={sheet}
                    padding={padding}
                    focus={focus}
                    focusOn={focusOn}
                    fitKey={fitKey}
                    refit={() => setFitKey((value) => value + 1)}
                    cars={cars}
                    setCars={setCars}
                    me={me}
                    setMe={setMe}
                    onTrip={(id) => {
                        // Each screen frames its own map.
                        setFocus(null);

                        if (!id) {
                            setFresh(true);
                            setMine((current) => current || { ready: true, tripId: null });
                        }

                        router.replace(id ? `/go?trip=${id}` : "/go", undefined, { shallow: true });
                    }}
                    toast={toast}
                    confirm={confirm}
                />
            </main>
        </>
    );
}

/* =========================================================
   ONE SCREEN: PLAN OR TRIP
========================================================= */

function GoScreen(props) {
    const { tripId } = props;

    return tripId ? <TripScreen {...props} /> : <PlanScreen {...props} />;
}

function TopBar({ onLocate, children }) {
    const g = useGoText();

    return (
        <header className="go-top">
            <Link href="/shipper" className="tk-round" aria-label={g("back")}>←</Link>
            <div className="go-top-title">
                <strong>⚡ {g("brand")}</strong>
                <span>{children || g("brandSub")}</span>
            </div>
            {onLocate && (
                <button type="button" className="tk-round" onClick={onLocate} aria-label={g("locate")} title={g("locate")}>
                    ◎
                </button>
            )}
        </header>
    );
}

/* =========================================================
   PLAN A DELIVERY
========================================================= */

function PlanScreen({ user, sheet, padding, focus, focusOn, fitKey, refit, cars, setCars, me, setMe, onTrip, toast }) {
    const { language } = useLanguage();

    const g = useGoText();

    const [pickup, setPickup] = useState(null);

    const [dropoff, setDropoff] = useState(null);

    // home → search → pin → options
    const [view, setView] = useState("home");

    const [field, setField] = useState("dropoff");

    const [pinPoint, setPinPoint] = useState(null);

    const [pinLabel, setPinLabel] = useState("");

    const [pinMoving, setPinMoving] = useState(false);

    // Prices for one pair of places: { key, data, error }.
    const [priced, setPriced] = useState({ key: null, data: null, error: false });

    const [choice, setChoice] = useState(null);

    const [cargo, setCargo] = useState("Parcel");

    const [note, setNote] = useState("");

    const [receiver, setReceiver] = useState("");

    const [payment, setPayment] = useState("CASH");

    const [busy, setBusy] = useState(false);

    const [locating, setLocating] = useState(false);

    /* ---------------- where am I? ---------------- */

    const locate = useCallback(
        async (asPickup = true) => {
            setLocating(true);

            try {
                const here = await locateOnce();

                if (!inCameroon(here)) {
                    focusOn(DEFAULT_CENTER, { zoom: 13 });
                    return null;
                }

                setMe(here);

                if (asPickup) {
                    const label = await labelFor(here, language);

                    setPickup({ lat: here.lat, lng: here.lng, label });
                }

                focusOn(here, { zoom: 16 });

                return here;
            } catch (error) {
                if (error?.code === 1) {
                    toast(g("locationBlocked"), "error");
                }

                return null;
            } finally {
                setLocating(false);
            }
        },
        // g and toast are stable enough for this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [language, focusOn, setMe]
    );

    // First visit: start from where the person is.
    useEffect(() => {
        const timer = setTimeout(() => locate(true), 0);

        return () => clearTimeout(timer);
        // Once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startTown = findCity(user.base_city || "", "CM");

    const start = startTown ? { lat: startTown.lat, lng: startTown.lng } : DEFAULT_CENTER;

    /* ---------------- cars around the pickup ---------------- */

    const around = pickup || me;

    useEffect(() => {
        if (!around) {
            return;
        }

        let alive = true;

        async function load() {
            try {
                const result = await apiGet(`/api/go?near=${around.lat},${around.lng}`);

                if (alive) {
                    setCars(result.cars || []);
                }
            } catch {
                // Cars are decoration: skip a missed update.
            }
        }

        load();

        const timer = setInterval(load, 12000);

        return () => {
            alive = false;
            clearInterval(timer);
        };
        // Only when the place moves.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [around?.lat, around?.lng]);

    /* ---------------- the pin ---------------- */

    useEffect(() => {
        if (view !== "pin" || !pinPoint) {
            return;
        }

        let alive = true;

        const timer = setTimeout(async () => {
            const label = await labelFor(pinPoint, language);

            if (alive) {
                setPinLabel(label);
                setPinMoving(false);
            }
        }, 500);

        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [view, pinPoint, language]);

    function openSearch(which) {
        setField(which);
        setView("search");
    }

    function openPin(which, at) {
        const start = at || (which === "pickup" ? pickup : dropoff) || (which === "dropoff" ? pickup : null) || me || DEFAULT_CENTER;

        setField(which);
        setPinPoint({ lat: start.lat, lng: start.lng });
        setPinLabel(at?.label || "");
        setPinMoving(!at?.label);
        setView("pin");

        focusOn(start, { zoom: 17, pick: true });
    }

    function confirmPin() {
        if (!pinPoint) {
            return;
        }

        const place = { lat: pinPoint.lat, lng: pinPoint.lng, label: pinLabel || nearLabel(pinPoint, language) };

        choose(field, place);
    }

    function choose(which, place) {
        const nextPickup = which === "pickup" ? place : pickup;
        const nextDropoff = which === "dropoff" ? place : dropoff;

        if (which === "pickup") {
            setPickup(place);
        } else {
            setDropoff(place);
        }

        if (nextPickup && nextDropoff) {
            setView("options");
            refit();
        } else if (!nextDropoff) {
            setField("dropoff");
            setView("search");
        } else {
            setField("pickup");
            setView("search");
        }
    }

    /* ---------------- prices ---------------- */

    const quoteKey = pickup && dropoff ? `${pickup.lat},${pickup.lng}|${dropoff.lat},${dropoff.lng}` : null;

    const quote = priced.key === quoteKey ? priced.data : null;

    const quoteError = priced.key === quoteKey && priced.error;

    useEffect(() => {
        if (!quoteKey) {
            return;
        }

        let alive = true;

        apiPost("/api/go", { action: "quote", pickup, dropoff })
            .then((result) => {
                if (!alive) {
                    return;
                }

                setPriced({ key: quoteKey, data: result, error: false });

                setChoice((current) => {
                    const fits = (key) => result.classes.find((item) => item.key === key && item.fits);

                    if (current && fits(current)) {
                        return current;
                    }

                    const withDriver = result.classes.find((item) => item.fits && item.eta_min !== null && item.key !== "MOTO");

                    return withDriver?.key || (fits("PICKUP") ? "PICKUP" : result.classes.find((item) => item.fits)?.key || "PICKUP");
                });

                refit();
            })
            .catch((error) => {
                if (alive) {
                    setPriced({ key: quoteKey, data: null, error: true });
                    toast(goError(language, error), "error");
                }
            });

        return () => {
            alive = false;
        };
        // When the two places change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteKey]);

    const selected = quote?.classes.find((item) => item.key === choice) || null;

    /* ---------------- order ---------------- */

    async function order() {
        if (!pickup || !dropoff || !selected || busy) {
            return;
        }

        setBusy(true);

        try {
            const result = await apiPost("/api/go", {
                action: "request",
                pickup: { lat: pickup.lat, lng: pickup.lng },
                dropoff: { lat: dropoff.lat, lng: dropoff.lng },
                pickupAddress: pickup.label,
                dropoffAddress: dropoff.label,
                vehicleClass: selected.key,
                itemType: cargo,
                note: note.trim(),
                receiverPhone: receiver.trim(),
                paymentMethod: payment,
            });

            saveRecent([pickup, dropoff]);

            onTrip(result.tripId);
        } catch (error) {
            toast(goError(language, error), "error");
        } finally {
            setBusy(false);
        }
    }

    /* ---------------- screen ---------------- */

    const picking = view === "pin" ? field : null;

    return (
        <>
            <GoMap
                center={start}
                pick={picking}
                onPick={(point) => {
                    setPinPoint(point);
                }}
                onPickMove={() => {
                    setPinMoving(true);
                }}
                pickup={pickup}
                dropoff={dropoff}
                line={view === "options" ? quote?.line : null}
                cars={view === "pin" ? [] : cars}
                focus={focus}
                fitKey={fitKey}
                padding={padding}
                label={g("brand")}
            />

            <TopBar onLocate={() => locate(view !== "options" && !pickup)} />

            <section ref={sheet} className={`go-sheet is-${view}`} aria-live="polite">
                <span className="go-grab" aria-hidden="true" />

                {/* ---------------- home ---------------- */}

                {view === "home" && (
                    <div className="go-body">
                        <h1 className="go-h1">{g("whereHeading")}</h1>
                        <PlacesCard pickup={pickup} dropoff={dropoff} onPick={openSearch} locating={locating} />
                        <RecentChips onChoose={(place) => choose(pickup ? "dropoff" : "pickup", place)} />
                    </div>
                )}

                {/* ---------------- search ---------------- */}

                {view === "search" && (
                    <SearchPanel
                        field={field}
                        near={pickup || me || DEFAULT_CENTER}
                        locating={locating}
                        onBack={() => setView(pickup && dropoff ? "options" : "home")}
                        onMyLocation={async () => {
                            const here = await locate(false);

                            if (here) {
                                const label = await labelFor(here, language);

                                choose(field, { lat: here.lat, lng: here.lng, label });
                            }
                        }}
                        onMap={() => openPin(field)}
                        onResult={(place) => openPin(field, place)}
                        onTown={(town) => openPin(field, { lat: town.lat, lng: town.lng, label: town.name })}
                    />
                )}

                {/* ---------------- pin ---------------- */}

                {view === "pin" && (
                    <div className="go-body">
                        <div className="go-pin-card">
                            <span className={`go-dot ${field === "pickup" ? "is-from" : "is-to"}`} aria-hidden="true" />
                            <div>
                                <small>{g(field)}</small>
                                <strong className={pinMoving ? "is-moving" : ""}>{pinMoving ? "…" : pinLabel || nearLabel(pinPoint, language)}</strong>
                            </div>
                        </div>
                        <p className="go-hint">✋ {g("moveMap")}</p>
                        <div className="go-row">
                            <button type="button" className="ts-btn ts-btn-light" onClick={() => setView("search")}>
                                ← {g("back")}
                            </button>
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg go-grow" onClick={confirmPin} disabled={!pinPoint}>
                                {g(field === "pickup" ? "confirmPickup" : "confirmDropoff")}
                            </button>
                        </div>
                    </div>
                )}

                {/* ---------------- options ---------------- */}

                {view === "options" && (
                    <div className="go-body go-options">
                        <PlacesCard pickup={pickup} dropoff={dropoff} onPick={openSearch} compact />

                        {quote ? (
                            <p className="go-route-sum">
                                🛣️ {g("routeSummary", { km: quote.km, time: goDuration(quote.minutes, language) })}
                            </p>
                        ) : (
                            <p className="go-route-sum">{quoteError ? g("quoteFailed") : g("loading")}</p>
                        )}

                        <div>
                            <span className="go-label">{g("chooseVehicle")}</span>
                            <div className="go-classes" role="radiogroup" aria-label={g("chooseVehicle")}>
                                {(quote?.classes || VEHICLE_CLASSES.map((item) => ({ key: item.key, price: null, fits: true, eta_min: null }))).map((item) => (
                                    <ClassCard key={item.key} item={item} active={choice === item.key} onChoose={() => item.fits && setChoice(item.key)} />
                                ))}
                            </div>
                            {selected && <p className="go-class-sub">{vehicleClass(selected.key)?.emoji} {g(`clsSub_${selected.key}`)}</p>}
                        </div>

                        <div>
                            <span className="go-label">{g("whatSending")}</span>
                            <div className="go-chips">
                                {CARGO_TYPES.slice(0, 6).map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        className={`go-chip ${cargo === type.value ? "active" : ""}`}
                                        onClick={() => setCargo(type.value)}
                                        aria-pressed={cargo === type.value}
                                    >
                                        {type.emoji} {cargoLabel(type.value, language)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="go-field">
                            <span className="go-label">{g("noteLabel")}</span>
                            <input className="mk-input" value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder={g("notePlaceholder")} />
                        </label>

                        <div className="go-field">
                            <span className="go-label">{g("receiverLabel")} <small>({language === "fr" ? "facultatif" : "optional"})</small></span>
                            <PhoneInput country="CM" onCountry={() => {}} value={receiver} onChange={setReceiver} required={false} />
                            <small className="go-small">{g("receiverHint")}</small>
                        </div>

                        <div className="go-field">
                            <span className="go-label">{g("payLabel")}</span>
                            <div className="go-segment">
                                {["CASH", "MOMO"].map((method) => (
                                    <button key={method} type="button" className={payment === method ? "active" : ""} onClick={() => setPayment(method)} aria-pressed={payment === method}>
                                        {g(method === "CASH" ? "payCash" : "payMomo")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="go-cta">
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg go-order" onClick={order} disabled={busy || !selected || !selected.fits}>
                                {busy ? g("ordering") : selected ? g("order", { price: formatMoney(selected.price, "XAF") }) : g("loading")}
                            </button>
                            <small>{g("fixedPrice")}</small>
                        </div>
                    </div>
                )}
            </section>
        </>
    );
}

async function labelFor(point, language) {
    try {
        const result = await apiGet(`/api/places?lat=${point.lat}&lng=${point.lng}&lang=${language}`);

        if (result.place?.label) {
            return result.place.label;
        }
    } catch {
        // No label: say which town it's near.
    }

    return nearLabel(point, language);
}

function nearLabel(point, language) {
    if (!point) {
        return "";
    }

    const town = nearestCity(point, "CM");

    if (!town) {
        return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
    }

    return town.km < 3 ? town.name : `${language === "fr" ? "Près de" : "Near"} ${town.name}`;
}

/* ---------------- pickup and drop-off rows ---------------- */

function PlacesCard({ pickup, dropoff, onPick, compact = false, locating = false }) {
    const g = useGoText();

    return (
        <div className={`go-places ${compact ? "is-compact" : ""}`}>
            <button type="button" className="go-place" onClick={() => onPick("pickup")}>
                <span className="go-dot is-from" aria-hidden="true" />
                <span>
                    <small>{g("pickup")}</small>
                    <strong className={pickup ? "" : "is-empty"}>{pickup?.label || (locating ? g("locating") : g("pickupPlaceholder"))}</strong>
                </span>
            </button>
            <span className="go-places-line" aria-hidden="true" />
            <button type="button" className="go-place" onClick={() => onPick("dropoff")}>
                <span className="go-dot is-to" aria-hidden="true" />
                <span>
                    <small>{g("dropoff")}</small>
                    <strong className={dropoff ? "" : "is-empty"}>{dropoff?.label || g("dropoffPlaceholder")}</strong>
                </span>
            </button>
        </div>
    );
}

function RecentChips({ onChoose }) {
    const g = useGoText();

    const [recent] = useState(readRecent);

    if (recent.length === 0) {
        return null;
    }

    return (
        <div>
            <span className="go-label">🕘 {g("recent")}</span>
            <div className="go-chips">
                {recent.map((place) => (
                    <button key={place.label} type="button" className="go-chip" onClick={() => onChoose(place)}>
                        {place.label.split(",")[0]}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ---------------- search a place ---------------- */

function SearchPanel({ field, near, locating, onBack, onMyLocation, onMap, onResult, onTown }) {
    const { language } = useLanguage();

    const g = useGoText();

    const [query, setQuery] = useState("");

    const [results, setResults] = useState(null);

    const [searching, setSearching] = useState(false);

    const [recent] = useState(readRecent);

    const towns = useMemo(() => {
        const text = query.trim().toLowerCase();

        if (text.length < 2) {
            return [];
        }

        return cityNames("CM")
            .filter((name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(text.normalize("NFD").replace(/[̀-ͯ]/g, "")))
            .slice(0, 4)
            .map((name) => findCity(name, "CM"));
    }, [query]);

    async function search(event) {
        event?.preventDefault();

        const text = query.trim();

        if (text.length < 2 || searching) {
            return;
        }

        setSearching(true);

        try {
            const result = await apiGet(`/api/places?q=${encodeURIComponent(text)}&near=${near.lat},${near.lng}&lang=${language}`);

            setResults(result.results || []);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }

    return (
        <div className="go-body go-search">
            <form className="go-search-bar" onSubmit={search}>
                <button type="button" className="go-icon-btn" onClick={onBack} aria-label={g("back")}>←</button>
                <span className={`go-dot ${field === "pickup" ? "is-from" : "is-to"}`} aria-hidden="true" />
                <input
                    className="go-search-input"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setResults(null);
                    }}
                    placeholder={g(field === "pickup" ? "searchPlaceholderPickup" : "searchPlaceholderDropoff")}
                    autoFocus
                    enterKeyHint="search"
                    aria-label={g(field)}
                />
                <button type="submit" className="ts-btn ts-btn-primary ts-btn-sm" disabled={query.trim().length < 2 || searching}>
                    {searching ? "…" : g("searchButton")}
                </button>
            </form>

            <ul className="go-list">
                {field === "pickup" && (
                    <li>
                        <button type="button" onClick={onMyLocation} disabled={locating}>
                            <span className="go-list-icon">📍</span>
                            <span><strong>{locating ? g("locating") : g("myLocation").replace("📍 ", "")}</strong></span>
                        </button>
                    </li>
                )}
                <li>
                    <button type="button" onClick={onMap}>
                        <span className="go-list-icon">🗺️</span>
                        <span><strong>{g("chooseOnMap").replace("🗺️ ", "")}</strong></span>
                    </button>
                </li>

                {query.trim().length >= 2 && results === null && (
                    <li>
                        <button type="button" onClick={search} disabled={searching}>
                            <span className="go-list-icon">🔎</span>
                            <span><strong>{searching ? g("searching") : g("searchMap", { q: query.trim() })}</strong></span>
                        </button>
                    </li>
                )}

                {results?.map((place, index) => (
                    <li key={`${place.lat},${place.lng},${index}`}>
                        <button type="button" onClick={() => onResult(place)}>
                            <span className="go-list-icon">📌</span>
                            <span>
                                <strong>{place.main || place.label}</strong>
                                {place.sub && <small>{place.sub}</small>}
                            </span>
                        </button>
                    </li>
                ))}

                {results && results.length === 0 && <li className="go-list-empty">{g("noResults")}</li>}

                {towns.length > 0 && <li className="go-list-head">{g("towns")}</li>}

                {towns.map((town) => (
                    <li key={town.name}>
                        <button type="button" onClick={() => onTown(town)}>
                            <span className="go-list-icon">🏙️</span>
                            <span><strong>{town.name}</strong></span>
                        </button>
                    </li>
                ))}

                {!query && recent.length > 0 && <li className="go-list-head">{g("recent")}</li>}

                {!query &&
                    recent.map((place) => (
                        <li key={place.label}>
                            <button type="button" onClick={() => onResult(place)}>
                                <span className="go-list-icon">🕘</span>
                                <span>
                                    <strong>{place.label.split(",")[0]}</strong>
                                    <small>{place.label.split(",").slice(1).join(",").trim()}</small>
                                </span>
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    );
}

/* ---------------- one vehicle ---------------- */

function ClassCard({ item, active, onChoose }) {
    const { language } = useLanguage();

    const g = useGoText();

    const info = vehicleClass(item.key);

    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            className={`go-class ${active ? "active" : ""} ${item.fits ? "" : "is-off"}`}
            onClick={onChoose}
            disabled={!item.fits}
        >
            <span className="go-class-emoji" aria-hidden="true">{info?.emoji}</span>
            <strong>{g(`cls_${item.key}`)}</strong>
            <span className="go-class-price">{item.price ? formatMoney(item.price, "XAF") : "—"}</span>
            <span className={`go-class-eta ${item.eta_min !== null ? "is-near" : ""}`}>
                {!item.fits ? g("clsTown") : item.eta_min !== null ? `⏱ ${goDuration(item.eta_min, language)}` : "—"}
            </span>
        </button>
    );
}

/* =========================================================
   A TRIP
========================================================= */

function TripScreen({ tripId, sheet, padding, fitKey, refit, cars, setCars, onTrip, toast, confirm }) {
    const router = useRouter();

    const { language } = useLanguage();

    const g = useGoText();

    const [data, setData] = useState(null);

    const [missing, setMissing] = useState(false);

    const [busy, setBusy] = useState(null);

    const [rated, setRated] = useState(false);

    const status = data?.trip?.status;

    const dispatch = data?.trip?.dispatch_status;

    const load = useCallback(async () => {
        try {
            const result = await apiGet(`/api/go?trip=${encodeURIComponent(tripId)}`);

            setData(result);
            setMissing(false);
        } catch (error) {
            if (error?.status === 404) {
                setMissing(true);
            }
        }
    }, [tripId]);

    // Faster while searching and while the car moves.
    const every = !status ? 2500 : status === "OPEN" ? (dispatch === "SEARCHING" ? 2500 : 15000) : status === "MATCHED" || status === "DEPARTED" ? 4000 : status === "ARRIVED" ? 5000 : 0;

    useEffect(() => {
        if (!every) {
            const once = setTimeout(load, 0);

            return () => clearTimeout(once);
        }

        return pollWhileVisible(load, every);
    }, [load, every]);

    // Frame the map again when the trip changes stage.
    const stage = `${status}|${dispatch}|${Boolean(data?.driver?.position)}|${Boolean(data?.trip?.at_pickup_at)}`;

    useEffect(() => {
        if (data) {
            refit();
        }
        // Only on a new stage.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);

    // Cars around the pickup while searching.
    const pickupPoint = data?.trip?.pickup?.lat ? data.trip.pickup : null;

    const searchingNow = status === "OPEN" && dispatch === "SEARCHING";

    useEffect(() => {
        if (!searchingNow || !pickupPoint) {
            setCars([]);
            return;
        }

        let alive = true;

        async function near() {
            try {
                const result = await apiGet(`/api/go?near=${pickupPoint.lat},${pickupPoint.lng}`);

                if (alive) {
                    setCars(result.cars || []);
                }
            } catch {
                // Decoration only.
            }
        }

        near();

        const timer = setInterval(near, 8000);

        return () => {
            alive = false;
            clearInterval(timer);
        };
        // Only when the search or the place changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchingNow, pickupPoint?.lat, pickupPoint?.lng]);

    /* ---------------- actions ---------------- */

    async function act(key, body, success) {
        setBusy(key);

        try {
            const result = await apiPost("/api/go", { ...body, tripId });

            if (success) {
                toast(success, "success");
            }

            await load();

            return result;
        } catch (error) {
            toast(goError(language, error), "error");
            await load();
            return null;
        } finally {
            setBusy(null);
        }
    }

    async function cancelTrip() {
        const yes = await confirm({ title: g("cancelTitle"), text: g("cancelText"), confirmLabel: g("cancelYes"), tone: "danger", icon: "✕" });

        if (yes) {
            await act("cancel", { action: "cancel" }, g("cancelled"));
        }
    }

    async function toBoard() {
        const result = await act("board", { action: "board" });

        if (result) {
            toast(g("toBoardDone"), "success");
            router.push("/shipper");
        }
    }

    async function rate(stars) {
        setBusy("rate");

        try {
            await apiPost("/api/shipper", { action: "rate", shipmentId: tripId, rating: stars });
            setRated(true);
            toast(g("rated"), "success");
            await load();
        } catch (error) {
            toast(goError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    /* ---------------- map ---------------- */

    const trip = data?.trip;

    const driver = data?.driver;

    const pickup = trip?.pickup?.lat ? { lat: trip.pickup.lat, lng: trip.pickup.lng } : null;

    const dropoff = trip?.dropoff?.lat ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng } : null;

    const car = driver?.position && ["MATCHED", "DEPARTED", "ARRIVED"].includes(status)
        ? { lat: driver.position.lat, lng: driver.position.lng, heading: driver.position.heading, cls: driver.vehicle_class }
        : null;

    const fitPoints =
        status === "OPEN"
            ? [pickup].filter(Boolean)
            : status === "MATCHED"
                ? (car ? [car, pickup] : [pickup, dropoff]).filter(Boolean)
                : status === "DEPARTED" || status === "ARRIVED"
                    ? (car ? [car, dropoff] : [pickup, dropoff]).filter(Boolean)
                    : [pickup, dropoff].filter(Boolean);

    const map = (
        <GoMap
            center={pickup || DEFAULT_CENTER}
            fitPoints={fitPoints}
            pickup={pickup}
            dropoff={dropoff}
            line={data?.route}
            cars={searchingNow ? cars : []}
            driver={car}
            radar={searchingNow ? pickup : null}
            fitKey={fitKey}
            padding={padding}
            label={g("brand")}
        />
    );

    if (missing) {
        return (
            <>
                {map}
                <TopBar />
                <section ref={sheet} className="go-sheet">
                    <span className="go-grab" aria-hidden="true" />
                    <div className="go-body go-center">
                        <div className="go-big-icon">🔎</div>
                        <h1 className="go-h1">{language === "fr" ? "Livraison introuvable" : "Delivery not found"}</h1>
                        <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={() => onTrip(null)}>⚡ {g("newDelivery")}</button>
                    </div>
                </section>
            </>
        );
    }

    if (!data) {
        return (
            <>
                {map}
                <TopBar />
                <section ref={sheet} className="go-sheet">
                    <span className="go-grab" aria-hidden="true" />
                    <div className="go-body go-center"><span className="go-spinner" aria-hidden="true" /><p>{g("loading")}</p></div>
                </section>
            </>
        );
    }

    const price = formatMoney(trip.price, trip.currency);

    const item = `${trip.quantity > 1 ? `${trip.quantity} × ` : ""}${cargoLabel(trip.item_type, language)}`;

    const link = trackLink(trip, language);

    return (
        <>
            {map}

            <TopBar onLocate={refit}>{vehicleClass(trip.vehicle_class)?.emoji} {g(`cls_${trip.vehicle_class}`)} · {price}</TopBar>

            <section ref={sheet} className={`go-sheet is-trip is-${String(status).toLowerCase()}`} aria-live="polite">
                <span className="go-grab" aria-hidden="true" />

                <div className="go-body">

                    {/* ---------------- searching ---------------- */}

                    {searchingNow && (
                        <div className="go-finding">
                            <div className="go-finding-head">
                                <span className="go-finding-pulse" aria-hidden="true" />
                                <div>
                                    <h1 className="go-h1">{g("findingTitle")}</h1>
                                    <p className="go-muted">
                                        {data.search?.waiting > 1
                                            ? g("findingAsking", { n: data.search.waiting })
                                            : data.search?.waiting === 1
                                                ? g("findingAskingOne")
                                            : data.search?.radius_km > 4
                                                ? g("findingWider", { km: data.search.radius_km })
                                                : g("findingStart")}
                                    </p>
                                </div>
                            </div>
                            <div className="go-progress" aria-hidden="true">
                                <i style={{ width: `${Math.min(100, Math.round(((data.search?.elapsed_s || 0) / (data.search?.max_s || 300)) * 100))}%` }} />
                            </div>
                        </div>
                    )}

                    {/* ---------------- nobody yet ---------------- */}

                    {status === "OPEN" && dispatch === "NO_DRIVER" && (
                        <div className="go-stack">
                            <div className="go-big-icon">😕</div>
                            <h1 className="go-h1">{g("noDriverTitle")}</h1>
                            <p className="go-muted">{g("noDriverText")}</p>
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={Boolean(busy)} onClick={() => act("retry", { action: "retry" })}>
                                🔄 {g("searchAgain")}
                            </button>
                            {nextClass(trip) && (
                                <button
                                    type="button"
                                    className="ts-btn ts-btn-light"
                                    disabled={Boolean(busy)}
                                    onClick={() => act("retry", { action: "retry", vehicleClass: nextClass(trip) })}
                                >
                                    {vehicleClass(nextClass(trip))?.emoji} {g("biggerVehicle", { cls: g(`cls_${nextClass(trip)}`), price: formatMoney(fareFor(nextClass(trip), trip.km), "XAF") })}
                                </button>
                            )}
                            <button type="button" className="ts-btn ts-btn-light" disabled={Boolean(busy)} onClick={toBoard}>
                                💬 {g("toBoard")}
                            </button>
                        </div>
                    )}

                    {/* ---------------- driver on the way / at pickup ---------------- */}

                    {status === "MATCHED" && (
                        <div className="go-eta-card">
                            {trip.at_pickup_at ? (
                                <>
                                    <small>📍 {g("driverHere")}</small>
                                    <strong>{g("driverHereText")}</strong>
                                </>
                            ) : (
                                <>
                                    <small>{g("driverComing")}</small>
                                    <strong>{driver?.eta_min !== null && driver?.eta_min !== undefined ? g("driverArrivesIn", { time: goDuration(driver.eta_min, language) }) : "…"}</strong>
                                    {driver?.km_away !== null && driver?.km_away !== undefined && <span>{g("km", { km: driver.km_away })}</span>}
                                </>
                            )}
                        </div>
                    )}

                    {status === "DEPARTED" && (
                        <div className="go-eta-card">
                            <small>🚚 {g("onTheWay")}</small>
                            <strong>{driver?.eta_min !== null && driver?.eta_min !== undefined ? g("arrivesAt", { time: goDuration(driver.eta_min, language) }) : "…"}</strong>
                            {driver?.km_away !== null && driver?.km_away !== undefined && <span>{g("km", { km: driver.km_away })} · {trip.dropoff.address}</span>}
                        </div>
                    )}

                    {status === "ARRIVED" && (
                        <div className="go-eta-card is-green">
                            <small>🏁 {g("atDropoff")}</small>
                            <strong>{g("atDropoffText")}</strong>
                        </div>
                    )}

                    {driver && ["MATCHED", "DEPARTED", "ARRIVED"].includes(status) && <DriverCard driver={driver} />}

                    {trip.delivery_code && ["MATCHED", "DEPARTED", "ARRIVED"].includes(status) && (
                        <div className="ap-code">
                            <strong style={{ color: "white" }}>🔑 {g("codeTitle")}</strong>
                            <CodeDigits code={trip.delivery_code} />
                            <span>{g("codeText")}</span>
                            <a
                                className="ts-btn ts-btn-whatsapp"
                                target="_blank"
                                rel="noopener noreferrer"
                                href={`${trip.receiver_phone ? whatsappHref(trip.receiver_phone) : "https://wa.me/"}?text=${encodeURIComponent(
                                    [g("codeMessage", { item, code: trip.delivery_code }), link ? g("followLink", { link }) : ""].filter(Boolean).join("\n\n")
                                )}`}
                            >
                                💬 {g("sendCode")}
                            </a>
                        </div>
                    )}

                    {/* ---------------- delivered ---------------- */}

                    {status === "COMPLETED" && (
                        <div className="go-stack go-center">
                            <div className="go-big-icon">✅</div>
                            <h1 className="go-h1">{g("delivered")}</h1>
                            <p className="go-muted">{g("deliveredText")}</p>
                            {!trip.driver_rating && !rated && driver ? (
                                <div className="go-rate">
                                    <strong>{g("rateDriver", { name: String(driver.name || "").split(/\s+/)[0] })}</strong>
                                    <Stars disabled={busy === "rate"} onRate={rate} />
                                </div>
                            ) : (
                                <span className="ap-chip ap-chip-amber">{"★".repeat(trip.driver_rating || 5)} · {g("rated")}</span>
                            )}
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={() => onTrip(null)}>
                                ⚡ {g("newDelivery")}
                            </button>
                        </div>
                    )}

                    {status === "CANCELLED" && (
                        <div className="go-stack go-center">
                            <div className="go-big-icon">✕</div>
                            <h1 className="go-h1">{g("tripCancelled")}</h1>
                            <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={() => onTrip(null)}>
                                ⚡ {g("newDelivery")}
                            </button>
                        </div>
                    )}

                    {/* ---------------- the trip ---------------- */}

                    <div className="go-summary">
                        <PlacesCard pickup={{ label: trip.pickup.address }} dropoff={{ label: trip.dropoff.address }} onPick={() => {}} compact />
                        <div className="go-kv">
                            <div><small>{g("price")}</small><strong>{price}</strong></div>
                            <div><small>{g("payment")}</small><strong>{trip.payment_method === "MOMO" ? g("momo") : g("cash")}</strong></div>
                            {trip.km !== null && <div><small>🛣️</small><strong>{g("km", { km: trip.km })}</strong></div>}
                            <div><small>{g("details")}</small><strong>{item}</strong></div>
                        </div>
                        {trip.note && <p className="go-note">📝 {trip.note}</p>}
                    </div>

                    {link && ["MATCHED", "DEPARTED", "ARRIVED"].includes(status) && (
                        <button
                            type="button"
                            className="ts-btn ts-btn-light"
                            onClick={async () => {
                                try {
                                    if (navigator.share) {
                                        await navigator.share({ title: g("brand"), url: link });
                                    } else {
                                        await navigator.clipboard.writeText(link);
                                        toast("✓", "success");
                                    }
                                } catch {
                                    // Share sheet closed.
                                }
                            }}
                        >
                            🛰️ {g("shareTrip")}
                        </button>
                    )}

                    {(status === "OPEN" || status === "MATCHED") && (
                        <button type="button" className="go-cancel" disabled={Boolean(busy)} onClick={cancelTrip}>
                            {searchingNow ? g("cancelSearch") : g("cancelTrip")}
                        </button>
                    )}

                </div>
            </section>
        </>
    );
}

function nextClass(trip) {
    const index = VEHICLE_CLASSES.findIndex((item) => item.key === trip.vehicle_class);

    const next = VEHICLE_CLASSES[index + 1];

    return next ? next.key : null;
}

/* ---------------- the driver ---------------- */

function DriverCard({ driver }) {
    const { language } = useLanguage();

    const g = useGoText();

    const first = String(driver.name || "").trim().split(/\s+/)[0] || "";

    return (
        <div className="go-driver-card">
            <div className="go-driver-top">
                <span className="go-avatar" aria-hidden="true">{first.slice(0, 1).toUpperCase()}</span>
                <div className="go-driver-who">
                    <strong>{driver.name}</strong>
                    <span>
                        {driver.rating_count ? `★ ${driver.rating} (${driver.rating_count})` : g("newDriver")}
                        {driver.trips ? ` · ${g("trips", { n: driver.trips })}` : ""}
                    </span>
                    <span>{vehicleClass(driver.vehicle_class)?.emoji} {driver.vehicle_type || g(`cls_${driver.vehicle_class}`)}</span>
                </div>
                {driver.plate && <span className="go-plate" aria-label={g("plate")}>{driver.plate}</span>}
            </div>

            {driver.minutes_ago > 3 && <p className="go-small">📡 {g("signalOld", { n: driver.minutes_ago })}</p>}

            {driver.phone && (
                <div className="go-row">
                    <a className="ts-btn ts-btn-primary go-grow" href={telHref(driver.phone)}>📞 {g("call")}</a>
                    <a className="ts-btn ts-btn-whatsapp go-grow" href={whatsappHref(driver.phone)} target="_blank" rel="noopener noreferrer">
                        💬 {g("whatsapp")}
                    </a>
                </div>
            )}

            {driver.phone && <p className="go-small">{formatPhone(driver.phone)} · {language === "fr" ? "Gardez ce numéro pour cette livraison seulement." : "Use this number for this delivery only."}</p>}
        </div>
    );
}

/* =========================================================
   SIMPLE SCREENS
========================================================= */

function GoLoading() {
    return (
        <main className="go-page go-page-plain">
            <span className="go-spinner" aria-hidden="true" />
        </main>
    );
}

function GoMessage({ icon, title, text, href, label }) {
    return (
        <main className="go-page go-page-plain">
            <div className="go-message">
                <div className="go-big-icon">{icon}</div>
                <h1 className="go-h1">{title}</h1>
                <p className="go-muted">{text}</p>
                <Link href={href} className="ts-btn ts-btn-primary ts-btn-lg">{label} →</Link>
            </div>
        </main>
    );
}
