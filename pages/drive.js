import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

import { digits, Sheet } from "../components/App/Bits";
import { useFeedback } from "../components/App/Feedback";
import Icon from "../components/Site/Icon";
import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { appError } from "../lib/appText";
import { cargoIcon, cargoLabel } from "../lib/cargo";
import { distanceKm, findCity } from "../lib/cities";
import { VEHICLE_CLASSES, vehicleClass } from "../lib/fleet";
import { goDuration, goError, useGoText } from "../lib/goText";
import { useLanguage } from "../lib/LanguageContext";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref } from "../lib/phone";
import { useMapPadding } from "../lib/useMapPadding";
import { leaveDashboard, useRoleUser } from "../lib/useSession";

/*
 * ============================================================
 * TAYEB PRO: THE DRIVER ON THE ROAD
 * ============================================================
 *
 * A full-screen map like a ride app for drivers:
 *
 *   offline   one big button to go online, today's numbers;
 *   online    the phone shares where it is; Tayeb sends the
 *             nearest deliveries. A request pops up with its
 *             price, the way to the pickup and the trip, a
 *             sound, a vibration and 20 seconds to accept;
 *   on a job  one step at a time: go to the pickup, load,
 *             deliver, enter the receiver's code, get paid.
 *
 * The screen asks for news every 3 seconds while online, and
 * the position goes out every few seconds (lib/server/go.js).
 */

const GoMap = dynamic(() => import("../components/Map/GoMap"), { ssr: false });

const SEND_EVERY_MS = 8000;

const SEND_MOVE_M = 30;

/* ---------------- a short "ding" without any sound file ---------------- */

let audio = null;

function unlockSound() {
    try {
        const Context = window.AudioContext || window.webkitAudioContext;

        if (!audio && Context) {
            audio = new Context();
        }

        audio?.resume?.();
    } catch {
        audio = null;
    }
}

function ding() {
    try {
        if (!audio) {
            return;
        }

        const start = audio.currentTime;

        [0, 0.18, 0.36].forEach((offset, index) => {
            const tone = audio.createOscillator();
            const gain = audio.createGain();

            tone.type = "sine";
            tone.frequency.value = index === 2 ? 1175 : 880;

            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);

            tone.connect(gain).connect(audio.destination);
            tone.start(start + offset);
            tone.stop(start + offset + 0.18);
        });
    } catch {
        // No sound: the screen and vibration still show it.
    }

    try {
        navigator.vibrate?.([220, 120, 220, 120, 320]);
    } catch {
        // Vibration not available.
    }
}

function navigateHref(point, app) {
    if (!point) {
        return null;
    }

    return app === "waze"
        ? `https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
}

// Exact point for Tayeb Go trips, the town for loads from the board.
function pointOf(place) {
    if (!place) {
        return null;
    }

    if (place.lat !== undefined && place.lat !== null) {
        return { lat: Number(place.lat), lng: Number(place.lng) };
    }

    const town = findCity(place.city || "");

    return town ? { lat: town.lat, lng: town.lng } : null;
}

export default function DrivePage() {
    const router = useRouter();

    const { language } = useLanguage();

    const g = useGoText();

    const { toast, confirm } = useFeedback();

    const [user, setUser] = useRoleUser("DRIVER");

    const [state, setState] = useState(null);

    const [me, setMe] = useState(null);

    const [geo, setGeo] = useState("idle");

    const [busy, setBusy] = useState(null);

    const [offer, setOffer] = useState(null);

    const [clock, setClock] = useState(() => Date.now());

    const [done, setDone] = useState(null);

    const [code, setCode] = useState("");

    const [picking, setPicking] = useState(false);

    const [fitKey, setFitKey] = useState(0);

    const [sheetElement, setSheetElement] = useState(null);

    const padding = useMapPadding(sheetElement);

    const online = Boolean(state?.online);

    const job = state?.job || null;

    const active = online || Boolean(job);

    /* =========================================================
       NEWS FROM TAYEB
    ========================================================= */

    const polls = useRef(0);

    const seenOffer = useRef(null);

    const load = useCallback(async () => {
        try {
            const full = polls.current % 10 === 0;

            polls.current += 1;

            const result = await apiGet(`/api/go?driver=1${full ? "&full=1" : ""}`);

            setState((current) => ({
                ...result,
                today: result.today || current?.today,
                rating: result.rating ?? current?.rating,
                rating_count: result.rating_count ?? current?.rating_count,
            }));

            if (result.offer && result.offer.id !== seenOffer.current) {
                seenOffer.current = result.offer.id;

                const now = Date.now();

                setClock(now);
                setOffer({ ...result.offer, deadline: now + result.offer.remaining_ms });

                ding();
            } else if (!result.offer) {
                // Taken by someone else, expired or answered.
                setOffer(null);
            }
        } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
                leaveDashboard(router, "DRIVER");
            }
        }
        // router is stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const userId = user?.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        return pollWhileVisible(load, active ? 3000 : 15000);
    }, [userId, active, load]);

    /* ---------------- the countdown ---------------- */

    useEffect(() => {
        if (!offer) {
            return;
        }

        const timer = setInterval(() => {
            const now = Date.now();

            setClock(now);

            if (offer.deadline - now <= -500) {
                setOffer(null);
            }
        }, 250);

        return () => clearInterval(timer);
    }, [offer]);

    const left = offer ? Math.max(0, Math.ceil((offer.deadline - clock) / 1000)) : 0;

    /* =========================================================
       MY POSITION
    ========================================================= */

    // Once, to show the map around the driver.
    useEffect(() => {
        if (!userId || typeof navigator === "undefined" || !("geolocation" in navigator)) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (fix) => {
                setMe((current) => current || { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy, heading: null });
                setFitKey((value) => value + 1);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
        );
    }, [userId]);

    // While online or on a job: follow the phone and tell Tayeb.
    useEffect(() => {
        if (!active || typeof navigator === "undefined" || !("geolocation" in navigator)) {
            return;
        }

        let lastSentAt = 0;
        let lastSent = null;
        let lock = null;
        let stopped = false;

        const watch = navigator.geolocation.watchPosition(
            (fix) => {
                const point = {
                    lat: fix.coords.latitude,
                    lng: fix.coords.longitude,
                    accuracy: fix.coords.accuracy,
                    heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null,
                    speed: Number.isFinite(fix.coords.speed) ? fix.coords.speed : null,
                };

                setGeo("on");
                setMe(point);

                const since = Date.now() - lastSentAt;

                const moved = lastSent ? distanceKm(lastSent, point) * 1000 : Infinity;

                if (point.accuracy > 200 && since < 60000) {
                    return;
                }

                if (since < SEND_EVERY_MS && moved < SEND_MOVE_M) {
                    return;
                }

                lastSentAt = Date.now();
                lastSent = point;

                apiPost("/api/go", { action: "heartbeat", ...point }).catch(() => {
                    lastSentAt = 0;
                });
            },
            (error) => setGeo(error.code === error.PERMISSION_DENIED ? "denied" : "idle"),
            { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 }
        );

        async function keepAwake() {
            try {
                if (!stopped && "wakeLock" in navigator && document.visibilityState === "visible") {
                    lock = await navigator.wakeLock.request("screen");
                }
            } catch {
                lock = null;
            }
        }

        function onVisible() {
            if (document.visibilityState === "visible") {
                keepAwake();
            }
        }

        keepAwake();

        document.addEventListener("visibilitychange", onVisible);

        return () => {
            stopped = true;
            navigator.geolocation.clearWatch(watch);
            document.removeEventListener("visibilitychange", onVisible);
            lock?.release?.().catch?.(() => {});
        };
    }, [active]);

    /* =========================================================
       ACTIONS
    ========================================================= */

    async function goOnline() {
        unlockSound();

        setBusy("online");

        try {
            const fix = await new Promise((resolve, reject) => {
                if (!("geolocation" in navigator)) {
                    reject({ code: 2 });
                    return;
                }

                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
            });

            const point = { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy, heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null };

            setMe(point);
            setGeo("on");

            const result = await apiPost("/api/go", { action: "online", online: true, ...point });

            setUser(result.user);
            setState((current) => ({ ...(current || {}), online: true }));
            setFitKey((value) => value + 1);

            await load();
        } catch (error) {
            if (error?.code === 1) {
                setGeo("denied");
            } else {
                toast(goError(language, error), "error");
            }
        } finally {
            setBusy(null);
        }
    }

    async function goOffline() {
        setBusy("online");

        try {
            const result = await apiPost("/api/go", { action: "online", online: false });

            setUser(result.user);
            setState((current) => ({ ...(current || {}), online: false, offer: null }));
            setOffer(null);
        } catch (error) {
            toast(goError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    async function answer(accept) {
        if (!offer) {
            return;
        }

        const id = offer.id;

        setBusy(accept ? "accept" : "skip");

        try {
            if (accept) {
                const result = await apiPost("/api/go", { action: "accept", offerId: id });

                setState((current) => ({ ...(current || {}), job: result.job, offer: null }));
                toast(g("drv_accepted"), "success");
                setFitKey((value) => value + 1);
            } else {
                await apiPost("/api/go", { action: "decline", offerId: id });
            }
        } catch (error) {
            toast(error?.code === "ALREADY_MATCHED" || error?.code === "GO_OFFER_GONE" ? g("drv_missed") : goError(language, error), "error");
        } finally {
            setOffer(null);
            setBusy(null);
            load();
        }
    }

    async function step(kind) {
        if (!job) {
            return;
        }

        if (kind === "DEPARTED" && !(await confirm({ title: g("drv_startTitle"), text: g("drv_startText"), confirmLabel: g("drv_loaded"), icon: "truck" }))) {
            return;
        }

        setBusy(kind);

        try {
            if (kind === "AT_PICKUP") {
                await apiPost("/api/go", { action: "atPickup", tripId: job.id });
            } else {
                await apiPost("/api/driver", { action: "status", shipmentId: job.id, status: kind, deliveryCode: kind === "COMPLETED" ? code : undefined });
            }

            if (kind === "COMPLETED") {
                setDone({ price: job.price, currency: job.currency, payment: job.payment_method });
                setCode("");
            }

            setFitKey((value) => value + 1);

            await load();
        } catch (error) {
            toast(goError(language, error) || appError(language, error), "error");
            await load();
        } finally {
            setBusy(null);
        }
    }

    async function dropJob() {
        if (!job) {
            return;
        }

        const yes = await confirm({ title: g("drv_dropTitle"), text: g("drv_dropText"), confirmLabel: g("drv_dropYes"), tone: "danger", icon: "refresh" });

        if (!yes) {
            return;
        }

        setBusy("drop");

        try {
            await apiPost("/api/go", { action: "dropJob", tripId: job.id });
            toast(g("drv_dropped"), "success");
            await load();
        } catch (error) {
            toast(goError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    async function chooseClass(key) {
        setBusy("class");

        try {
            const result = await apiPost("/api/go", { action: "vehicleClass", vehicleClass: key });

            setUser(result.user);
            setState((current) => ({ ...(current || {}), vehicle_class: key }));
            setPicking(false);
            toast(g("drv_vehicleSaved"), "success");
        } catch (error) {
            toast(goError(language, error), "error");
        } finally {
            setBusy(null);
        }
    }

    /* =========================================================
       THE MAP
    ========================================================= */

    const shown = offer ? offer.trip : job;

    const pickup = pointOf(shown?.pickup);
    const dropoff = pointOf(shown?.dropoff);

    const self = me ? { lat: me.lat, lng: me.lng, heading: me.heading, accuracy: me.accuracy } : null;

    const fitPoints = offer
        ? [self, pickup, dropoff].filter(Boolean)
        : job
            ? (job.status === "MATCHED" ? [self, pickup] : [self, dropoff]).filter(Boolean)
            : [self].filter(Boolean);

    // Framed again at each new stage, or when asked.
    const fitStage = `${offer?.id || ""}|${job?.id || ""}|${job?.status || ""}|${job?.at_pickup_at ? 1 : 0}|${fitKey}`;

    /* =========================================================
       SCREEN
    ========================================================= */

    if (!user || !state) {
        return (
            <main className="go-page go-page-plain">
                <span className="go-spinner" aria-hidden="true" />
            </main>
        );
    }

    if (state.ready === false) {
        return (
            <main className="go-page go-page-plain">
                <div className="go-message">
                    <div className="go-big-icon"><Icon name="zap" size={30} /></div>
                    <h1 className="go-h1">{g("notReady")}</h1>
                    <p className="go-muted">{language === "fr" ? "En attendant, trouvez des chargements sur la bourse de fret." : "Meanwhile, find loads on the loads board."}</p>
                    <Link href="/driver" className="ts-btn ts-btn-primary ts-btn-lg">{g("drv_board")} →</Link>
                </div>
            </main>
        );
    }

    const myClass = state.vehicle_class || user.vehicle_class || "PICKUP";

    const today = state.today;

    return (
        <>
            <Head>
                <title>{`${g("drv_title")} · Tayeb`}</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className={`go-page is-driver ${online ? "is-online" : ""}`}>
                <GoMap
                    center={self || { lat: 4.0511, lng: 9.7679 }}
                    self={self}
                    pickup={pickup}
                    dropoff={dropoff}
                    radar={online && !job && !offer ? self : null}
                    fitKey={fitStage}
                    fitPoints={fitPoints}
                    padding={padding}
                    label={g("drv_title")}
                />

                <header className="go-top">
                    <Link href="/driver" className="tk-round" aria-label={g("drv_dashboard")} title={g("drv_dashboard")}><Icon name="menu" size={20} /></Link>
                    <div className="go-top-title">
                        <strong><span className={`go-status-dot ${online ? "is-on" : ""}`} aria-hidden="true" /> {g("drv_title")}</strong>
                        <span>
                            {today ? `${g("drv_today")} · ${formatMoney(today.earned, today.currency)} · ${today.trips} ${g("drv_trips").toLowerCase()}` : g("drv_today")}
                        </span>
                    </div>
                    <button type="button" className="tk-round" onClick={() => setFitKey((value) => value + 1)} aria-label={g("locate")} title={g("locate")}>
                        ◎
                    </button>
                </header>

                <section ref={setSheetElement} className={`go-sheet is-driver ${job ? "is-job" : ""}`} aria-live="polite">
                    <span className="go-grab" aria-hidden="true" />

                    <div className="go-body">

                        {/* ---------------- delivery done ---------------- */}

                        {done && !job && (
                            <div className="go-stack go-center">
                                <div className="go-big-icon is-good"><Icon name="check" size={30} /></div>
                                <h1 className="go-h1">{g("drv_doneTitle")}</h1>
                                <p className="go-earned">+{formatMoney(done.price, done.currency)}</p>
                                <p className="go-muted">{g("drv_doneText", { price: formatMoney(done.price, done.currency), pay: done.payment === "MOMO" ? g("momo") : g("drv_cash") })}</p>
                                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" onClick={() => setDone(null)}>{g("drv_continue")} →</button>
                            </div>
                        )}

                        {/* ---------------- on a job ---------------- */}

                        {job && <JobPanel job={job} me={me} busy={busy} code={code} setCode={setCode} onStep={step} onDrop={dropJob} />}

                        {/* ---------------- waiting ---------------- */}

                        {!job && !done && (
                            <>
                                {geo === "denied" && (
                                    <div className="ap-note ap-note-red" style={{ display: "grid", gap: 6 }}>
                                        <strong><Icon name="pin" /> {g("drv_needLocation")}</strong>
                                        <span>{g("drv_needLocationText")}</span>
                                    </div>
                                )}

                                {online ? (
                                    <div className="go-online">
                                        <div className="go-online-pill"><span className="ts-pulse" aria-hidden="true" style={{ background: "#22c55e" }} /> {g("drv_onlineTitle")}</div>
                                        <p className="go-muted">{g("drv_onlineText")}</p>
                                    </div>
                                ) : (
                                    <div className="go-offline">
                                        <button type="button" className="go-go" onClick={goOnline} disabled={busy === "online"} aria-label={g("drv_goOnline")}>
                                            <span>{busy === "online" ? "…" : "GO"}</span>
                                        </button>
                                        <div>
                                            <h1 className="go-h1">{g("drv_offlineTitle")}</h1>
                                            <p className="go-muted">{g("drv_offlineText")}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="go-stats">
                                    <div><small>{g("drv_earned")}</small><strong>{today ? formatMoney(today.earned, today.currency) : "—"}</strong></div>
                                    <div><small>{g("drv_trips")}</small><strong>{today ? today.trips : "—"}</strong></div>
                                    <div><small>{g("drv_acceptance")}</small><strong>{today?.acceptance !== null && today?.acceptance !== undefined ? `${today.acceptance}%` : "—"}</strong></div>
                                    <div><small>{g("drv_rating")}</small><strong>{state.rating_count ? state.rating : "—"}</strong></div>
                                </div>

                                <div className="go-vehicle-row">
                                    <span className="go-vehicle-emoji" aria-hidden="true"><Icon name={vehicleClass(myClass)?.icon} size={28} stroke={1.5} /></span>
                                    <div>
                                        <small>{g("drv_vehicle")}</small>
                                        <strong>{g(`cls_${myClass}`)}</strong>
                                    </div>
                                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={() => setPicking(true)}>{g("drv_changeVehicle")}</button>
                                </div>

                                {online && (
                                    <button type="button" className="ts-btn ts-btn-light" onClick={goOffline} disabled={busy === "online"}>
                                        <Icon name="pause" /> {g("drv_goOffline")}
                                    </button>
                                )}

                                {online && <p className="go-small" style={{ textAlign: "center" }}>{g("drv_keepOpen")}</p>}

                                <Link href="/driver" className="go-link"><Icon name="dashboard" /> {g("drv_board")} →</Link>
                            </>
                        )}
                    </div>
                </section>

                {/* ---------------- a request ---------------- */}

                {offer && !job && <OfferCard offer={offer} left={left} busy={busy} onAccept={() => answer(true)} onSkip={() => answer(false)} />}

                {picking && (
                    <Sheet title={g("drv_vehicle")} onClose={() => setPicking(false)} busy={busy === "class"}>
                        <div className="go-class-list">
                            {VEHICLE_CLASSES.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={`go-class-row ${myClass === item.key ? "active" : ""}`}
                                    onClick={() => chooseClass(item.key)}
                                    disabled={busy === "class"}
                                >
                                    <span className="go-vehicle-emoji" aria-hidden="true"><Icon name={item.icon} size={26} stroke={1.5} /></span>
                                    <span>
                                        <strong>{g(`cls_${item.key}`)}</strong>
                                        <small>{g(`clsSub_${item.key}`)}</small>
                                    </span>
                                    {myClass === item.key && <Icon name="check" />}
                                </button>
                            ))}
                        </div>
                    </Sheet>
                )}
            </main>
        </>
    );
}

/* =========================================================
   A REQUEST: 20 SECONDS TO ACCEPT
========================================================= */

function OfferCard({ offer, left, busy, onAccept, onSkip }) {
    const { language } = useLanguage();

    const g = useGoText();

    const trip = offer.trip;

    const share = Math.max(0, Math.min(1, left / (offer.seconds || 20)));

    return (
        <div className="go-offer-backdrop" role="dialog" aria-modal="true" aria-label={g("drv_newRequest")}>
            <div className="go-offer">
                <div className="go-offer-head">
                    <div>
                        <span className="go-kicker"><Icon name="zap" /> {g("drv_newRequest")}</span>
                        <div className="go-offer-price">{formatMoney(trip.price, trip.currency)}</div>
                        <span className="go-chip-inline">{trip.payment_method === "MOMO" ? g("payMomo") : g("payCash")}</span>
                        <span className="go-chip-inline"><Icon name={vehicleClass(trip.vehicle_class)?.icon} size={15} /> {g(`cls_${trip.vehicle_class}`)}</span>
                    </div>
                    <div className="go-ring" style={{ "--share": share }} aria-label={`${left} s`}>
                        <span>{left}</span>
                    </div>
                </div>

                <div className="go-offer-route">
                    <div className="go-offer-stop">
                        <span className="go-dot is-from" aria-hidden="true" />
                        <div>
                            <small>{offer.pickup_km !== null ? g("drv_toPickup", { km: offer.pickup_km, time: goDuration(offer.pickup_min, language) }) : g("pickup")}</small>
                            <strong>{trip.pickup.address}</strong>
                        </div>
                    </div>
                    <div className="go-offer-stop">
                        <span className="go-dot is-to" aria-hidden="true" />
                        <div>
                            <small>{trip.km !== null ? `${g("drv_trip", { km: trip.km })} · ${goDuration(trip.minutes, language)}` : g("dropoff")}</small>
                            <strong>{trip.dropoff.address}</strong>
                        </div>
                    </div>
                </div>

                <p className="go-offer-cargo">
                    <Icon name={cargoIcon(trip.item_type)} /> {trip.quantity > 1 ? `${trip.quantity} × ` : ""}{cargoLabel(trip.item_type, language)}
                    {trip.note ? ` · ${trip.note}` : ""}
                </p>

                <div className="go-offer-actions">
                    <button type="button" className="ts-btn ts-btn-light ts-btn-lg" onClick={onSkip} disabled={Boolean(busy)}>
                        {g("drv_skip")}
                    </button>
                    <button type="button" className="go-accept" onClick={onAccept} disabled={Boolean(busy)}>
                        <i style={{ transform: `scaleX(${share})` }} aria-hidden="true" />
                        <span>{busy === "accept" ? "…" : g("drv_accept")}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   ONE STEP AT A TIME ON A JOB
========================================================= */

function JobPanel({ job, me, busy, code, setCode, onStep, onDrop }) {
    const { language } = useLanguage();

    const g = useGoText();

    const pickup = pointOf(job.pickup);
    const dropoff = pointOf(job.dropoff);

    const toPickup = job.status === "MATCHED";

    const target = toPickup ? pickup : dropoff;

    const km = me && target ? Math.round(distanceKm(me, target) * 1.3 * 10) / 10 : null;

    const stage = toPickup ? (job.at_pickup_at ? "load" : "pickup") : job.status === "DEPARTED" ? "deliver" : "code";

    const title = { pickup: g("drv_goPickup"), load: g("drv_loadGoods"), deliver: g("drv_goDropoff"), code: g("drv_codeTitle") }[stage];

    const place = toPickup ? job.pickup : job.dropoff;

    return (
        <div className="go-stack go-job">
            <div className="go-job-head">
                <span className={`go-step-badge is-${stage}`}>{stage === "pickup" || stage === "load" ? "A" : "B"}</span>
                <div>
                    <h1 className="go-h1">{title}</h1>
                    <p className="go-muted">
                        {place.address}
                        {km !== null && stage !== "load" && stage !== "code" ? ` · ${g("km", { km })}` : ""}
                    </p>
                </div>
                <strong className="go-job-price">{formatMoney(job.price, job.currency)}</strong>
            </div>

            {(stage === "pickup" || stage === "deliver") && target && (
                <div className="go-row">
                    <a className="ts-btn ts-btn-ink go-grow" href={navigateHref(target, "google")} target="_blank" rel="noopener noreferrer"><Icon name="navigation" /> {g("drv_navigate")}</a>
                    <a className="ts-btn ts-btn-light" href={navigateHref(target, "waze")} target="_blank" rel="noopener noreferrer">{g("drv_waze")}</a>
                </div>
            )}

            <div className="go-contacts">
                {job.customer?.phone && (
                    <a className="go-contact" href={telHref(job.customer.phone)}>
                        <span><Icon name="phone" /></span>
                        <span><small>{g("drv_customer")}</small><strong>{job.customer.name}</strong></span>
                    </a>
                )}
                {job.pickup_phone && toPickup && (
                    <a className="go-contact" href={telHref(job.pickup_phone)}>
                        <span><Icon name="sprout" /></span>
                        <span><small>{g("drv_callFarm")}</small><strong>{job.pickup_name || formatPhone(job.pickup_phone)}</strong></span>
                    </a>
                )}
                {job.receiver_phone && !toPickup && (
                    <a className="go-contact" href={telHref(job.receiver_phone)}>
                        <span><Icon name="phone" /></span>
                        <span><small>{g("drv_receiver")}</small><strong>{formatPhone(job.receiver_phone)}</strong></span>
                    </a>
                )}
            </div>

            <p className="go-offer-cargo">
                <Icon name={cargoIcon(job.item_type)} /> {job.quantity > 1 ? `${job.quantity} × ` : ""}{cargoLabel(job.item_type, language)}
                {job.note ? ` · ${job.note}` : ""}
                {` · ${job.payment_method === "MOMO" ? g("momo") : g("drv_cash")}`}
            </p>

            {stage === "pickup" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={Boolean(busy)} onClick={() => onStep("AT_PICKUP")}>
                    <Icon name="pin" /> {g("drv_atPickup")}
                </button>
            )}

            {stage === "load" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={Boolean(busy)} onClick={() => onStep("DEPARTED")}>
                    <Icon name="truck" /> {g("drv_loaded")}
                </button>
            )}

            {stage === "deliver" && (
                <button type="button" className="ts-btn ts-btn-primary ts-btn-lg" disabled={Boolean(busy)} onClick={() => onStep("ARRIVED")}>
                    <Icon name="flag" /> {g("drv_arrived")}
                </button>
            )}

            {stage === "code" && job.code_locked && (
                <div className="ap-note ap-note-red"><Icon name="lock" /><span>{g("drv_codeLocked")}</span></div>
            )}

            {stage === "code" && !job.code_locked && (
                <form
                    className="go-stack"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onStep("COMPLETED");
                    }}
                >
                    {job.needs_code && (
                        <>
                            <input
                                className="go-code-input"
                                value={code}
                                onChange={(event) => setCode(digits(event.target.value).slice(0, 4))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="• • • •"
                                aria-label={g("drv_codeTitle")}
                                autoFocus
                            />
                            <p className="go-small">{g("drv_codeHint")}</p>
                        </>
                    )}
                    <button type="submit" className="ts-btn ts-btn-green ts-btn-lg" disabled={Boolean(busy) || (job.needs_code && code.length !== 4)}>
                        <Icon name="check" /> {g("drv_finish")}
                    </button>
                </form>
            )}

            {toPickup && job.mode === "INSTANT" && (
                <button type="button" className="go-cancel" onClick={onDrop} disabled={Boolean(busy)}>
                    {g("drv_drop")}
                </button>
            )}
        </div>
    );
}
