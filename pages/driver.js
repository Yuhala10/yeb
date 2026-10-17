import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { apiGet, apiPost, pollWhileVisible } from "../lib/api";
import { cityNames, distanceKm } from "../lib/cities";
import { formatMoney } from "../lib/money";
import { formatPhone, telHref } from "../lib/phone";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";
import Notifications from "../components/Notifications";
import DeleteAccount from "../components/Account/DeleteAccount";
import { inviteShippersOnWhatsApp } from "../lib/shareLoad";

export default function DriverPage() {
    const router = useRouter();

    const {
        language,
        setLanguage,
        t,
    } = useLanguage();

    const [user, setUser] = useState(null);

    const [shipments, setShipments] =
        useState([]);

    const [driverBids, setDriverBids] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [available, setAvailable] =
        useState(true);

    const [selectedShipment, setSelectedShipment] =
        useState(null);

    const [showOfferForm, setShowOfferForm] =
        useState(false);

    const [offerPrice, setOfferPrice] =
        useState("");

    const [offerTime, setOfferTime] =
        useState("");

    const [offerNote, setOfferNote] =
        useState("");

    const [submittingOffer, setSubmittingOffer] =
        useState(false);

    const [counterPrice, setCounterPrice] =
        useState("");

    const [counterBid, setCounterBid] =
        useState(null);

    const [counterLoading, setCounterLoading] =
        useState(false);

    const [statusLoading, setStatusLoading] =
        useState(false);

    /*
     * Location sharing while goods are on the road:
     * "idle" (not started), "on", or "denied".
     */
    const [tracking, setTracking] =
        useState("idle");

    const [trackingAttempt, setTrackingAttempt] =
        useState(0);


    /* =========================================================
       SESSION ENDED
    ========================================================= */

    function goToLogin() {
        localStorage.removeItem(
            "tayebUser"
        );

        localStorage.removeItem(
            "selectedRole"
        );

        router.replace("/login");
    }

    function showError(error) {
        if (error?.status === 401) {
            goToLogin();
            return;
        }

        alert(
            error?.message ||
            t(
                "errors.somethingWrong"
            )
        );
    }


    /* =========================================================
       OPEN OFFER FORM
    ========================================================= */

    function openOfferForm(
        shipment,
        bid
    ) {
        setSelectedShipment(
            shipment
        );

        setShowOfferForm(
            true
        );

        setOfferPrice(
            bid?.proposed_price
                ? String(
                    bid.proposed_price
                )
                : ""
        );

        setOfferTime(
            bid?.eta ||
            ""
        );

        setOfferNote(
            bid?.note ||
            ""
        );
    }


    /* =========================================================
       SHARED LOAD LINK
    =========================================================
     *
     * A driver who opened /load/[id] from WhatsApp lands here
     * after login with that load's offer form already open.
     */

    function openSharedLoad(
        loadedShipments,
        loadedBids
    ) {
        let pendingLoadId = null;

        try {
            pendingLoadId =
                localStorage.getItem(
                    "tayebPendingLoad"
                );

            localStorage.removeItem(
                "tayebPendingLoad"
            );
        } catch {
            return;
        }

        if (!pendingLoadId) {
            return;
        }

        const shipment =
            loadedShipments.find(
                (item) =>
                    item.status ===
                    "OPEN" &&
                    String(item.id) ===
                    pendingLoadId
            );

        if (!shipment) {
            return;
        }

        openOfferForm(
            shipment,
            loadedBids.find(
                (bid) =>
                    bid.shipment_id ===
                    shipment.id
            )
        );
    }


    /* =========================================================
       LOAD DASHBOARD
    =========================================================
     *
     * One call returns the driver's profile, loads ranked for
     * them (return loads and loads in their city first), their
     * deliveries and their offers. It runs again every 20
     * seconds while the page is open, without a spinner.
     */

    async function fetchShipments() {
        try {
            const data =
                await apiGet(
                    "/api/driver"
                );

            setUser(
                data.user
            );

            setAvailable(
                data.user?.is_available ??
                true
            );

            setShipments(
                data.shipments ||
                []
            );

            setDriverBids(
                data.bids ||
                []
            );

            localStorage.setItem(
                "tayebUser",
                JSON.stringify(
                    data.user
                )
            );

            openSharedLoad(
                data.shipments ||
                [],
                data.bids ||
                []
            );
        } catch (error) {
            console.error(
                "Driver dashboard error:",
                error
            );

            if (
                error?.status ===
                401 ||
                error?.status ===
                403
            ) {
                goToLogin();
            }
        } finally {
            setLoading(false);
        }
    }


    /* =========================================================
       LOAD DRIVER
    ========================================================= */

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        async function restoreSession() {
            try {
                const result =
                    await apiGet(
                        "/api/session/me"
                    );

                if (
                    !result.user?.id ||
                    result.user.role !== "DRIVER"
                ) {
                    goToLogin();
                    return;
                }

                setUser(result.user);

                localStorage.setItem(
                    "selectedRole",
                    result.user.role
                );
            } catch (error) {
                console.error(
                    "Could not restore Tayeb session:",
                    error
                );

                goToLogin();
            }
        }

        restoreSession();
        // Runs once when the page opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);


    /* =========================================================
       KEEP UP TO DATE
    ========================================================= */

    const userId =
        user?.id;

    useEffect(() => {
        if (!userId) {
            return;
        }

        return pollWhileVisible(
            fetchShipments,
            20000
        );
        // fetchShipments only sets state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);


    /* =========================================================
       PRICE
    ========================================================= */

    function cleanPrice(
        value
    ) {
        return String(
            value || ""
        ).replace(
            /[^\d]/g,
            ""
        );
    }

    function formatPrice(
        value
    ) {
        const number =
            Number(value);

        if (
            !Number.isFinite(
                number
            )
        ) {
            return "0";
        }

        return number.toLocaleString(
            "en-US"
        );
    }


    /* =========================================================
       SEND OR UPDATE MY PRICE
    ========================================================= */

    async function submitOffer(
        event
    ) {
        event.preventDefault();

        if (
            !selectedShipment ||
            !user
        ) {
            return;
        }

        const price =
            Number(
                cleanPrice(
                    offerPrice
                )
            );

        if (
            !price ||
            price <= 0
        ) {
            alert(
                t(
                    "errors.invalidPrice"
                )
            );

            return;
        }

        setSubmittingOffer(true);

        try {
            await apiPost(
                "/api/driver",
                {
                    action: "offer",
                    shipmentId:
                        selectedShipment.id,
                    price,
                    eta:
                        offerTime,
                    note:
                        offerNote,
                }
            );

            setOfferPrice("");
            setOfferTime("");
            setOfferNote("");

            setShowOfferForm(
                false
            );

            setSelectedShipment(
                null
            );

            await fetchShipments();

            alert(
                t(
                    "driver.offerSent"
                )
            );
        } catch (error) {
            console.error(
                "Submit offer error:",
                error
            );

            showError(error);
        } finally {
            setSubmittingOffer(
                false
            );
        }
    }


    /* =========================================================
       ACCEPT THE SHIPPER'S PRICE
    ========================================================= */

    async function acceptCounterPrice(
        bid
    ) {
        if (
            !user ||
            !bid
        ) {
            return;
        }

        try {
            await apiPost(
                "/api/driver",
                {
                    action: "acceptCounter",
                    bidId:
                        bid.id,
                }
            );

            setCounterBid(
                null
            );

            setCounterPrice(
                ""
            );

            await fetchShipments();

            alert(
                t(
                    "driver.accepted"
                )
            );
        } catch (error) {
            console.error(
                "Accept counter error:",
                error
            );

            showError(error);

            await fetchShipments();
        }
    }


    /* =========================================================
       DRIVER SENDS ANOTHER PRICE
    ========================================================= */

    async function suggestAnotherPrice(
        bid
    ) {
        if (
            !user ||
            !bid
        ) {
            return;
        }

        const price =
            Number(
                cleanPrice(
                    counterPrice
                )
            );

        if (
            !price ||
            price <= 0
        ) {
            alert(
                t(
                    "errors.invalidPrice"
                )
            );

            return;
        }

        setCounterLoading(
            true
        );

        try {
            await apiPost(
                "/api/driver",
                {
                    action: "counter",
                    bidId:
                        bid.id,
                    price,
                }
            );

            setCounterPrice(
                ""
            );

            setCounterBid(
                null
            );

            await fetchShipments();

            alert(
                t(
                    "driver.offerSent"
                )
            );
        } catch (error) {
            console.error(
                "Suggest price error:",
                error
            );

            showError(error);
        } finally {
            setCounterLoading(
                false
            );
        }
    }


    /* =========================================================
       AVAILABILITY AND CITY
    ========================================================= */

    async function updateProfile(
        changes
    ) {
        if (!user) {
            return;
        }

        try {
            const result =
                await apiPost(
                    "/api/driver",
                    {
                        action: "profile",
                        ...changes,
                    }
                );

            setUser(
                result.user
            );

            setAvailable(
                result.user?.is_available ??
                true
            );

            localStorage.setItem(
                "tayebUser",
                JSON.stringify(
                    result.user
                )
            );

            // The city changes which loads come first.
            if (
                changes.baseCity !==
                undefined
            ) {
                await fetchShipments();
            }
        } catch (error) {
            console.error(
                "Profile error:",
                error
            );

            showError(error);
        }
    }

    function toggleAvailability() {
        updateProfile({
            available:
                !available,
        });
    }


    /* =========================================================
       DELIVERY STATUS
    =========================================================
     *
     * Finishing a delivery needs the receiver's 4-digit code
     * (deliveryCode), which proves the goods arrived.
     */

    async function updateStatus(
        shipment,
        status,
        deliveryCode
    ) {
        if (
            !user ||
            !shipment ||
            statusLoading
        ) {
            return false;
        }

        setStatusLoading(
            true
        );

        try {
            await apiPost(
                "/api/driver",
                {
                    action: "status",
                    shipmentId:
                        shipment.id,
                    status,
                    deliveryCode,
                }
            );

            await fetchShipments();

            return true;
        } catch (error) {
            console.error(
                "Delivery status error:",
                error
            );

            showError(error);

            await fetchShipments();

            return false;
        } finally {
            setStatusLoading(
                false
            );
        }
    }


    /* =========================================================
       LOGOUT
    ========================================================= */

    async function logout() {
        try {
            await fetch(
                "/api/session/logout",
                {
                    method: "POST",
                    credentials: "include",
                }
            );
        } catch (error) {
            console.error(
                "Logout error:",
                error
            );
        } finally {
            goToLogin();
        }
    }


    /* =========================================================
       FIND DRIVER BID
    ========================================================= */

    function getDriverBid(
        shipmentId
    ) {
        return driverBids.find(
            (bid) =>
                bid.shipment_id ===
                shipmentId
        );
    }


    /* =========================================================
       DASHBOARD DATA
    ========================================================= */

    const availableJobs =
        useMemo(
            () =>
                shipments.filter(
                    (item) =>
                        item.status ===
                        "OPEN"
                ),
            [shipments]
        );

    const activeJobs =
        useMemo(
            () =>
                shipments.filter(
                    (item) =>
                        item.driver_id ===
                        user?.id &&
                        item.status !==
                        "COMPLETED" &&
                        item.status !==
                        "CANCELLED"
                ),
            [shipments, user]
        );

    const completedJobs =
        useMemo(
            () =>
                shipments.filter(
                    (item) =>
                        item.driver_id ===
                        user?.id &&
                        item.status ===
                        "COMPLETED"
                ),
            [shipments, user]
        );

    const pendingOffers =
        useMemo(
            () =>
                driverBids.filter(
                    (bid) =>
                        bid.status ===
                        "PENDING" ||
                        (
                            bid.status ===
                            "COUNTERED" &&
                            bid.last_offer_by ===
                            "SHIPPER"
                        )
                ),
            [driverBids]
        );


    /* =========================================================
       LIVE LOCATION
    =========================================================
     *
     * While a delivery is on the road (DEPARTED) and this page
     * is open, the phone's position is sent to the shipper:
     * at most once a minute, or sooner after 300 m of driving.
     * It stops when the driver marks "Arrived". Browsers don't
     * allow this while the page is closed.
     */

    const roadJobId =
        activeJobs.find(
            (item) =>
                item.status ===
                "DEPARTED"
        )?.id;

    useEffect(() => {
        if (
            !roadJobId ||
            typeof navigator ===
            "undefined" ||
            !navigator.geolocation
        ) {
            return;
        }

        let lastSentAt = 0;
        let lastPoint = null;

        const watchId =
            navigator.geolocation.watchPosition(
                (position) => {
                    setTracking("on");

                    const point = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };

                    const movedKm =
                        lastPoint
                            ? distanceKm(
                                lastPoint,
                                point
                            )
                            : Infinity;

                    if (
                        Date.now() - lastSentAt <
                        60000 &&
                        movedKm < 0.3
                    ) {
                        return;
                    }

                    lastSentAt =
                        Date.now();

                    lastPoint =
                        point;

                    apiPost(
                        "/api/driver",
                        {
                            action: "location",
                            shipmentId:
                                roadJobId,
                            lat: point.lat,
                            lng: point.lng,
                            accuracy:
                                position.coords.accuracy,
                        }
                    ).catch((error) => {
                        console.log(
                            "Location update failed:",
                            error
                        );
                    });
                },
                (error) => {
                    setTracking(
                        error.code ===
                            error.PERMISSION_DENIED
                            ? "denied"
                            : "idle"
                    );
                },
                {
                    enableHighAccuracy:
                        true,
                    maximumAge:
                        30000,
                    timeout:
                        60000,
                }
            );

        return () =>
            navigator.geolocation.clearWatch(
                watchId
            );
    }, [roadJobId, trackingAttempt]);

    function retryTracking() {
        setTracking("idle");

        setTrackingAttempt(
            (current) =>
                current + 1
        );
    }


    /* =========================================================
       LOADING
    ========================================================= */

    if (!user) {
        return (
            <main
                style={{
                    minHeight:
                        "100vh",
                    display:
                        "grid",
                    placeItems:
                        "center",
                    background:
                        "#fff",
                }}
            >
                <BrandLogo
                    width={130}
                    height={48}
                />
            </main>
        );
    }


    return (
        <>
            <Head>
                <title>
                    Tayeb —{" "}
                    {t(
                        "driver.dashboard"
                    )}
                </title>

                <meta
                    name="description"
                    content={t(
                        "driver.dashboard"
                    )}
                />
            </Head>


            <main className="tayeb-app">

                {/* =================================================
                    TOP BAR
                ================================================= */}

                <header className="tayeb-topbar">

                    <div>
                        <BrandLogo
                            width={105}
                            height={40}
                        />
                    </div>


                    <div className="tayeb-topbar-right">

                        {/* LANGUAGE */}

                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                gap:
                                    "3px",
                                padding:
                                    "4px",
                                border:
                                    "1px solid #e5e7eb",
                                borderRadius:
                                    "12px",
                                background:
                                    "white",
                            }}
                        >

                            <button
                                type="button"
                                onClick={() =>
                                    setLanguage(
                                        "en"
                                    )
                                }
                                style={{
                                    border: 0,
                                    borderRadius:
                                        "8px",
                                    padding:
                                        "6px 8px",
                                    background:
                                        language ===
                                            "en"
                                            ? "#fff7ed"
                                            : "transparent",
                                    color:
                                        language ===
                                            "en"
                                            ? "#f97316"
                                            : "#6b7280",
                                    fontSize:
                                        "12px",
                                    fontWeight:
                                        900,
                                    cursor:
                                        "pointer",
                                }}
                            >
                                EN
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setLanguage(
                                        "fr"
                                    )
                                }
                                style={{
                                    border: 0,
                                    borderRadius:
                                        "8px",
                                    padding:
                                        "6px 8px",
                                    background:
                                        language ===
                                            "fr"
                                            ? "#fff7ed"
                                            : "transparent",
                                    color:
                                        language ===
                                            "fr"
                                            ? "#f97316"
                                            : "#6b7280",
                                    fontSize:
                                        "12px",
                                    fontWeight:
                                        900,
                                    cursor:
                                        "pointer",
                                }}
                            >
                                FR
                            </button>

                        </div>


                        {/* NOTIFICATIONS */}

                        <Notifications
                            userId={
                                user.id
                            }
                        />


                        {/* AVATAR */}

                        <div
                            className="tayeb-avatar"
                            title={
                                user.full_name
                            }
                        >
                            {user.full_name
                                ?.charAt(
                                    0
                                )
                                ?.toUpperCase() ||
                                "D"}
                        </div>

                    </div>

                </header>


                {/* =================================================
                    DASHBOARD
                ================================================= */}

                <div className="tayeb-dashboard">

                    {/* WELCOME */}

                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "flex-end",
                            gap:
                                "20px",
                            flexWrap:
                                "wrap",
                            marginBottom:
                                "28px",
                        }}
                    >

                        <div>

                            <span className="tayeb-section-label">
                                TAYEB
                            </span>

                            <h1
                                style={{
                                    color:
                                        "#111827",
                                    fontSize:
                                        "clamp(30px, 5vw, 46px)",
                                    lineHeight:
                                        1,
                                    letterSpacing:
                                        "-0.05em",
                                    fontWeight:
                                        900,
                                }}
                            >
                                {t(
                                    "driver.greeting"
                                )}
                                ,{" "}
                                <span
                                    style={{
                                        color:
                                            "#f97316",
                                    }}
                                >
                                    {
                                        user.full_name
                                    }
                                </span>
                            </h1>

                            <p
                                style={{
                                    marginTop:
                                        "10px",
                                    color:
                                        "#6b7280",
                                    fontSize:
                                        "15px",
                                }}
                            >
                                {t(
                                    "driver.dashboard"
                                )}
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={
                                logout
                            }
                            className="tayeb-button tayeb-button-secondary"
                        >
                            {t(
                                "common.logout"
                            )}
                        </button>

                    </div>


                    {/* =================================================
                        AVAILABILITY
                    ================================================= */}

                    <section
                        className="tayeb-card"
                        style={{
                            padding:
                                "20px",
                            marginBottom:
                                "20px",
                        }}
                    >

                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                justifyContent:
                                    "space-between",
                                gap:
                                    "15px",
                            }}
                        >

                            <div
                                style={{
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    gap:
                                        "13px",
                                }}
                            >

                                <div
                                    style={{
                                        width:
                                            "48px",
                                        height:
                                            "48px",
                                        display:
                                            "grid",
                                        placeItems:
                                            "center",
                                        borderRadius:
                                            "15px",
                                        background:
                                            available
                                                ? "#f0fdf4"
                                                : "#f3f4f6",
                                        fontSize:
                                            "22px",
                                    }}
                                >
                                    {available
                                        ? "🟢"
                                        : "⚪"}
                                </div>

                                <div>

                                    <strong
                                        style={{
                                            display:
                                                "block",
                                            color:
                                                "#111827",
                                            fontSize:
                                                "14px",
                                        }}
                                    >
                                        {t(
                                            "driver.availability"
                                        )}
                                    </strong>

                                    <span
                                        style={{
                                            display:
                                                "block",
                                            marginTop:
                                                "3px",
                                            color:
                                                available
                                                    ? "#16a34a"
                                                    : "#9ca3af",
                                            fontSize:
                                                "13px",
                                            fontWeight:
                                                800,
                                        }}
                                    >
                                        {available
                                            ? t(
                                                "driver.availableNow"
                                            )
                                            : t(
                                                "driver.busyNow"
                                            )}
                                    </span>

                                </div>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    toggleAvailability
                                }
                                className={
                                    available
                                        ? "tayeb-button tayeb-button-success"
                                        : "tayeb-button tayeb-button-light"
                                }
                            >
                                {available
                                    ? t(
                                        "driver.turnOff"
                                    )
                                    : t(
                                        "driver.turnOn"
                                    )}
                            </button>

                        </div>


                        {/* MY CITY: loads here come first */}

                        <div
                            style={{
                                display:
                                    "flex",
                                flexWrap:
                                    "wrap",
                                alignItems:
                                    "center",
                                gap:
                                    "10px",
                                marginTop:
                                    "16px",
                                paddingTop:
                                    "16px",
                                borderTop:
                                    "1px solid #f1f5f9",
                            }}
                        >

                            <label
                                htmlFor="driver-city"
                                style={{
                                    color:
                                        "#111827",
                                    fontSize:
                                        "15px",
                                    fontWeight:
                                        800,
                                }}
                            >
                                📍{" "}
                                {t(
                                    "driver.myCity"
                                )}
                            </label>

                            <select
                                id="driver-city"
                                className="tayeb-input"
                                value={
                                    user.base_city ||
                                    ""
                                }
                                onChange={(
                                    event
                                ) =>
                                    updateProfile({
                                        baseCity:
                                            event.target.value ||
                                            null,
                                    })
                                }
                                style={{
                                    flex:
                                        "1 1 180px",
                                    maxWidth:
                                        "280px",
                                }}
                            >
                                <option value="">
                                    {t(
                                        "driver.chooseCity"
                                    )}
                                </option>

                                {cityNames(user.country || "CM").map(
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

                            <span
                                style={{
                                    flexBasis:
                                        "100%",
                                    color:
                                        "#6b7280",
                                    fontSize:
                                        "13px",
                                }}
                            >
                                {t(
                                    "driver.myCityHint"
                                )}
                            </span>

                        </div>

                    </section>


                    {/* =================================================
                        SUMMARY
                    ================================================= */}

                    <div
                        className="tayeb-dashboard-grid"
                        style={{
                            marginBottom:
                                "25px",
                        }}
                    >

                        <StatCard
                            icon="📦"
                            value={
                                availableJobs.length
                            }
                            label={
                                t(
                                    "driver.availableJobs"
                                )
                            }
                        />

                        <StatCard
                            icon="🚚"
                            value={
                                activeJobs.length
                            }
                            label={
                                t(
                                    "driver.currentDelivery"
                                )
                            }
                        />

                        <StatCard
                            icon="✓"
                            value={
                                completedJobs.length
                            }
                            label={
                                t(
                                    "driver.completedDeliveries"
                                )
                            }
                        />

                        <StatCard
                            icon="💰"
                            value={
                                pendingOffers.length
                            }
                            label={
                                t(
                                    "shipper.driverOffers"
                                )
                            }
                        />

                    </div>


                    {/* =================================================
                        ACTIVE DELIVERY
                    ================================================= */}

                    {activeJobs.length >
                        0 && (
                            <section
                                style={{
                                    marginBottom:
                                        "35px",
                                }}
                            >

                                <div
                                    style={{
                                        marginBottom:
                                            "14px",
                                    }}
                                >

                                    <span className="tayeb-section-label">
                                        TAYEB
                                    </span>

                                    <h2
                                        style={{
                                            fontSize:
                                                "22px",
                                            fontWeight:
                                                900,
                                            color:
                                                "#111827",
                                        }}
                                    >
                                        {t(
                                            "driver.currentDelivery"
                                        )}
                                    </h2>

                                </div>


                                <div
                                    style={{
                                        display:
                                            "grid",
                                        gap:
                                            "15px",
                                    }}
                                >

                                    {activeJobs.map(
                                        (
                                            shipment
                                        ) => (
                                            <ActiveDelivery
                                                key={
                                                    shipment.id
                                                }
                                                shipment={
                                                    shipment
                                                }
                                                t={
                                                    t
                                                }
                                                formatPrice={
                                                    formatPrice
                                                }
                                                updateStatus={
                                                    updateStatus
                                                }
                                                statusLoading={
                                                    statusLoading
                                                }
                                                tracking={
                                                    tracking
                                                }
                                                retryTracking={
                                                    retryTracking
                                                }
                                            />
                                        )
                                    )}

                                </div>

                            </section>
                        )}


                    {/* =================================================
                        AVAILABLE CARGO
                    ================================================= */}

                    <section>

                        <div
                            style={{
                                display:
                                    "flex",
                                alignItems:
                                    "flex-end",
                                justifyContent:
                                    "space-between",
                                gap:
                                    "15px",
                                marginBottom:
                                    "15px",
                            }}
                        >

                            <div>

                                <span className="tayeb-section-label">
                                    TAYEB
                                </span>

                                <h2
                                    style={{
                                        fontSize:
                                            "22px",
                                        fontWeight:
                                            900,
                                        color:
                                            "#111827",
                                    }}
                                >
                                    {t(
                                        "driver.availableJobs"
                                    )}
                                </h2>

                            </div>

                            <span className="tayeb-badge tayeb-badge-orange">
                                {
                                    availableJobs.length
                                }
                            </span>

                        </div>


                        {loading ? (
                            <div className="tayeb-empty">

                                <span className="tayeb-spinner tayeb-spinner-orange" />

                                <p
                                    style={{
                                        marginTop:
                                            "12px",
                                    }}
                                >
                                    {t(
                                        "common.loading"
                                    )}
                                </p>

                            </div>
                        ) : availableJobs.length ===
                            0 ? (
                            <div className="tayeb-empty">

                                <div className="tayeb-empty-icon">
                                    🚚
                                </div>

                                <h3>
                                    {t(
                                        "driver.noCargo"
                                    )}
                                </h3>

                                <p>
                                    {t(
                                        "driver.checkAgain"
                                    )}
                                </p>

                                <p
                                    style={{
                                        maxWidth:
                                            "340px",
                                        margin:
                                            "18px auto 0",
                                    }}
                                >
                                    {t(
                                        "driver.inviteShippersHint"
                                    )}
                                </p>

                                <button
                                    type="button"
                                    onClick={() =>
                                        inviteShippersOnWhatsApp(
                                            language
                                        )
                                    }
                                    className="tayeb-button tayeb-button-whatsapp"
                                    style={{
                                        marginTop:
                                            "12px",
                                    }}
                                >
                                    💬{" "}
                                    {t(
                                        "driver.inviteShippers"
                                    )}
                                </button>

                            </div>
                        ) : (
                            <div
                                style={{
                                    display:
                                        "grid",
                                    gap:
                                        "15px",
                                }}
                            >

                                {availableJobs.map(
                                    (
                                        shipment
                                    ) => {
                                        const bid =
                                            getDriverBid(
                                                shipment.id
                                            );

                                        return (
                                            <CargoCard
                                                key={
                                                    shipment.id
                                                }
                                                shipment={
                                                    shipment
                                                }
                                                bid={
                                                    bid
                                                }
                                                t={
                                                    t
                                                }
                                                formatPrice={
                                                    formatPrice
                                                }
                                                onOffer={() =>
                                                    openOfferForm(
                                                        shipment,
                                                        bid
                                                    )
                                                }
                                                onCounter={() => {
                                                    setCounterBid(
                                                        bid
                                                    );

                                                    setCounterPrice(
                                                        ""
                                                    );
                                                }}
                                            />
                                        );
                                    }
                                )}

                            </div>
                        )}

                    </section>


                    {/* =================================================
                        OFFER FORM
                    ================================================= */}

                    {showOfferForm &&
                        selectedShipment && (
                            <ModalOverlay
                                onClose={() => {
                                    if (
                                        !submittingOffer
                                    ) {
                                        setShowOfferForm(
                                            false
                                        );

                                        setSelectedShipment(
                                            null
                                        );
                                    }
                                }}
                            >

                                <div>

                                    <span className="tayeb-section-label">
                                        {t(
                                            "driver.sendOffer"
                                        )}
                                    </span>

                                    <h2
                                        style={{
                                            color:
                                                "#111827",
                                            fontSize:
                                                "25px",
                                            fontWeight:
                                                900,
                                            marginBottom:
                                                "18px",
                                        }}
                                    >
                                        {
                                            selectedShipment.item_type
                                        }
                                    </h2>


                                    <div
                                        className="tayeb-route"
                                        style={{
                                            marginBottom:
                                                "20px",
                                        }}
                                    >

                                        <div className="tayeb-route-point">

                                            <span className="tayeb-route-label">
                                                {t(
                                                    "shipper.pickupLocation"
                                                )}
                                            </span>

                                            <div className="tayeb-route-city">
                                                {
                                                    selectedShipment.origin
                                                }
                                            </div>

                                        </div>

                                        <div className="tayeb-route-arrow">
                                            →
                                        </div>

                                        <div className="tayeb-route-point">

                                            <span className="tayeb-route-label">
                                                {t(
                                                    "shipper.deliveryLocation"
                                                )}
                                            </span>

                                            <div className="tayeb-route-city">
                                                {
                                                    selectedShipment.destination
                                                }
                                            </div>

                                        </div>

                                    </div>


                                    <div
                                        style={{
                                            padding:
                                                "14px",
                                            background:
                                                "#fff7ed",
                                            borderRadius:
                                                "15px",
                                            marginBottom:
                                                "20px",
                                        }}
                                    >

                                        <span
                                            style={{
                                                display:
                                                    "block",
                                                color:
                                                    "#9a3412",
                                                fontSize:
                                                    "12px",
                                                fontWeight:
                                                    800,
                                            }}
                                        >
                                            {t(
                                                "shipper.yourPrice"
                                            )}
                                        </span>

                                        <strong
                                            style={{
                                                display:
                                                    "block",
                                                marginTop:
                                                    "4px",
                                                color:
                                                    "#ea580c",
                                                fontSize:
                                                    "20px",
                                            }}
                                        >
                                            {formatMoney(
                                                selectedShipment.initial_offer,
                                                selectedShipment.currency
                                            )}
                                        </strong>

                                    </div>


                                    <form
                                        onSubmit={
                                            submitOffer
                                        }
                                    >

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "driver.yourPrice"
                                                )}
                                            </label>

                                            <input
                                                inputMode="numeric"
                                                value={
                                                    offerPrice
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setOfferPrice(
                                                        cleanPrice(
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: 25000"
                                                disabled={
                                                    submittingOffer
                                                }
                                            />

                                            <small
                                                style={{
                                                    color:
                                                        "#9ca3af",
                                                    fontSize:
                                                        "13px",
                                                }}
                                            >
                                                {t(
                                                    "driver.priceHint"
                                                )}
                                            </small>

                                        </div>


                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "driver.arrivalTime"
                                                )}
                                            </label>

                                            <input
                                                type="text"
                                                value={
                                                    offerTime
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setOfferTime(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: 30 minutes"
                                                disabled={
                                                    submittingOffer
                                                }
                                            />

                                        </div>


                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">

                                                {t(
                                                    "driver.note"
                                                )}

                                                <span
                                                    style={{
                                                        color:
                                                            "#9ca3af",
                                                        marginLeft:
                                                            "4px",
                                                    }}
                                                >
                                                    (
                                                    {t(
                                                        "driver.optional"
                                                    )}
                                                    )
                                                </span>

                                            </label>

                                            <textarea
                                                value={
                                                    offerNote
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setOfferNote(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                rows={
                                                    3
                                                }
                                                placeholder="Example: Covered truck available."
                                                disabled={
                                                    submittingOffer
                                                }
                                                style={{
                                                    resize:
                                                        "vertical",
                                                }}
                                            />

                                        </div>


                                        <button
                                            type="submit"
                                            disabled={
                                                submittingOffer
                                            }
                                            className="tayeb-button tayeb-button-primary tayeb-button-full"
                                        >

                                            {submittingOffer ? (
                                                <>
                                                    <span className="tayeb-spinner" />

                                                    {t(
                                                        "common.loading"
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {t(
                                                        "driver.sendOfferButton"
                                                    )}
                                                    →
                                                </>
                                            )}

                                        </button>

                                    </form>

                                </div>

                            </ModalOverlay>
                        )}


                    {/* =================================================
                        COUNTER PRICE
                    ================================================= */}

                    {counterBid && (
                        <ModalOverlay
                            onClose={() => {
                                if (
                                    !counterLoading
                                ) {
                                    setCounterBid(
                                        null
                                    );

                                    setCounterPrice(
                                        ""
                                    );
                                }
                            }}
                        >

                            <div>

                                <span className="tayeb-section-label">
                                    {t(
                                        "driver.suggestPrice"
                                    )}
                                </span>

                                <h2
                                    style={{
                                        color:
                                            "#111827",
                                        fontSize:
                                            "24px",
                                        fontWeight:
                                            900,
                                        marginBottom:
                                            "18px",
                                    }}
                                >
                                    {t(
                                        "driver.counterReceived"
                                    )}
                                </h2>


                                <div
                                    style={{
                                        padding:
                                            "18px",
                                        borderRadius:
                                            "18px",
                                        background:
                                            "#fff7ed",
                                        marginBottom:
                                            "18px",
                                    }}
                                >

                                    <span
                                        style={{
                                            display:
                                                "block",
                                            color:
                                                "#9a3412",
                                            fontSize:
                                                "12px",
                                            fontWeight:
                                                800,
                                        }}
                                    >
                                        {t(
                                            "shipper.suggestedPrice"
                                        )}
                                    </span>

                                    <strong
                                        style={{
                                            display:
                                                "block",
                                            marginTop:
                                                "5px",
                                            color:
                                                "#ea580c",
                                            fontSize:
                                                "27px",
                                        }}
                                    >
                                        {formatMoney(
                                            counterBid.counter_price,
                                            shipments.find((item) => item.id === counterBid.shipment_id)?.currency
                                        )}
                                    </strong>

                                </div>


                                <button
                                    type="button"
                                    onClick={() =>
                                        acceptCounterPrice(
                                            counterBid
                                        )
                                    }
                                    className="tayeb-button tayeb-button-success tayeb-button-full"
                                    disabled={
                                        counterLoading
                                    }
                                >
                                    ✓{" "}
                                    {t(
                                        "common.confirm"
                                    )}
                                </button>


                                <div
                                    style={{
                                        marginTop:
                                            "15px",
                                        paddingTop:
                                            "15px",
                                        borderTop:
                                            "1px solid #e5e7eb",
                                    }}
                                >

                                    <label className="tayeb-label">
                                        {t(
                                            "driver.yourPrice"
                                        )}
                                    </label>

                                    <input
                                        inputMode="numeric"
                                        value={
                                            counterPrice
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setCounterPrice(
                                                cleanPrice(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            )
                                        }
                                        className="tayeb-input"
                                        placeholder="Example: 22000"
                                        disabled={
                                            counterLoading
                                        }
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            suggestAnotherPrice(
                                                counterBid
                                            )
                                        }
                                        className="tayeb-button tayeb-button-primary tayeb-button-full"
                                        style={{
                                            marginTop:
                                                "10px",
                                        }}
                                        disabled={
                                            counterLoading
                                        }
                                    >
                                        {t(
                                            "driver.updateOffer"
                                        )}
                                    </button>

                                </div>

                            </div>

                        </ModalOverlay>
                    )}


                    {/* =================================================
                        COMPLETED
                    ================================================= */}

                    {completedJobs.length >
                        0 && (
                            <section
                                style={{
                                    marginTop:
                                        "40px",
                                }}
                            >

                                <span className="tayeb-section-label">
                                    TAYEB
                                </span>

                                <h2
                                    style={{
                                        fontSize:
                                            "22px",
                                        fontWeight:
                                            900,
                                        color:
                                            "#111827",
                                        marginBottom:
                                            "15px",
                                    }}
                                >
                                    {t(
                                        "driver.completedDeliveries"
                                    )}
                                </h2>


                                <div
                                    style={{
                                        display:
                                            "grid",
                                        gap:
                                            "12px",
                                    }}
                                >

                                    {completedJobs.map(
                                        (
                                            shipment
                                        ) => (
                                            <div
                                                key={
                                                    shipment.id
                                                }
                                                className="tayeb-card"
                                                style={{
                                                    padding:
                                                        "18px",
                                                }}
                                            >

                                                <div
                                                    style={{
                                                        display:
                                                            "flex",
                                                        justifyContent:
                                                            "space-between",
                                                        gap:
                                                            "15px",
                                                    }}
                                                >

                                                    <div>

                                                        <strong
                                                            style={{
                                                                color:
                                                                    "#111827",
                                                                fontSize:
                                                                    "15px",
                                                            }}
                                                        >
                                                            {
                                                                shipment.item_type
                                                            }
                                                        </strong>

                                                        <p
                                                            style={{
                                                                marginTop:
                                                                    "4px",
                                                                color:
                                                                    "#6b7280",
                                                                fontSize:
                                                                    "13px",
                                                            }}
                                                        >
                                                            {
                                                                shipment.origin
                                                            }
                                                            {" → "}
                                                            {
                                                                shipment.destination
                                                            }
                                                        </p>

                                                    </div>

                                                    <span className="tayeb-badge tayeb-badge-success">
                                                        ✓{" "}
                                                        {t(
                                                            "status.completed"
                                                        )}
                                                    </span>

                                                </div>

                                            </div>
                                        )
                                    )}

                                </div>

                            </section>
                        )}

                    {/* =================================================
                        FOOTER
                    ================================================= */}

                    <footer
                        style={{
                            marginTop:
                                "50px",
                            paddingTop:
                                "25px",
                            borderTop:
                                "1px solid #e5e7eb",
                            textAlign:
                                "center",
                        }}
                    >

                        <BrandLogo
                            width={95}
                            height={36}
                        />

                        <p
                            style={{
                                marginTop:
                                    "10px",
                                color:
                                    "#9ca3af",
                                fontSize:
                                    "12px",
                                fontWeight:
                                    700,
                            }}
                        >
                            {t(
                                "common.tagline"
                            )}
                        </p>

                    </footer>

                </div>


                <DeleteAccount user={user} />

            </main>
        </>
    );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
    icon,
    value,
    label,
}) {
    return (
        <div className="tayeb-span-3">

            <div className="tayeb-stat-card">

                <div className="tayeb-stat-card-top">

                    <div className="tayeb-stat-icon">
                        {icon}
                    </div>

                </div>

                <div className="tayeb-stat-label">
                    {label}
                </div>

                <div className="tayeb-stat-value">
                    {value}
                </div>

            </div>

        </div>
    );
}


/* =========================================================
   CARGO CARD
========================================================= */

function CargoCard({
    shipment,
    bid,
    t,
    formatPrice,
    onOffer,
    onCounter,
}) {
    const hasCounter =
        bid &&
        bid.status ===
        "COUNTERED" &&
        bid.last_offer_by ===
        "SHIPPER" &&
        bid.counter_price !==
        null;

    return (
        <article className="tayeb-shipment-card">

            <div
                style={{
                    display:
                        "flex",
                    justifyContent:
                        "space-between",
                    alignItems:
                        "flex-start",
                    gap:
                        "15px",
                }}
            >

                <div>

                    <span
                        style={{
                            display:
                                "block",
                            color:
                                "#9ca3af",
                            fontSize:
                                "12px",
                            fontWeight:
                                800,
                            marginBottom:
                                "5px",
                            textTransform:
                                "uppercase",
                        }}
                    >
                        {t(
                            "common.cargo"
                        )}
                    </span>

                    <h3
                        style={{
                            color:
                                "#111827",
                            fontSize:
                                "18px",
                            fontWeight:
                                900,
                        }}
                    >
                        {
                            shipment.item_type
                        }
                    </h3>

                </div>

                <span className="tayeb-badge tayeb-badge-orange">
                    {t(
                        "status.open"
                    )}
                </span>

            </div>


            {/* FARM PRODUCE */}

            {shipment.is_produce && (
                <div
                    style={{
                        marginTop:
                            "14px",
                        padding:
                            "11px 13px",
                        borderRadius:
                            "13px",
                        background:
                            "#ecfdf5",
                        border:
                            "1px solid #bbf7d0",
                        color:
                            "#166534",
                        fontSize:
                            "14px",
                        fontWeight:
                            800,
                        lineHeight:
                            1.5,
                    }}
                >
                    {t(
                        "driver.produceLoad"
                    )}
                    {shipment.weight_kg > 0 &&
                        ` · ~${formatPrice(shipment.weight_kg)} kg`}
                    {shipment.perishable && (
                        <span
                            style={{
                                display:
                                    "block",
                                color:
                                    "#92400e",
                            }}
                        >
                            {t(
                                "driver.freshFast"
                            )}
                        </span>
                    )}
                </div>
            )}


            {/* WHY THIS LOAD FITS */}

            {shipment.match && (
                <div
                    style={{
                        marginTop:
                            "14px",
                        padding:
                            "10px 12px",
                        borderRadius:
                            "13px",
                        background:
                            shipment.match.type ===
                                "RETURN"
                                ? "#ecfdf5"
                                : "#eff6ff",
                        border:
                            shipment.match.type ===
                                "RETURN"
                                ? "1px solid #a7f3d0"
                                : "1px solid #bfdbfe",
                        color:
                            shipment.match.type ===
                                "RETURN"
                                ? "#065f46"
                                : "#1e40af",
                        fontSize:
                            "14px",
                        fontWeight:
                            800,
                    }}
                >
                    {t(
                        shipment.match.type ===
                            "RETURN"
                            ? "driver.returnLoad"
                            : "driver.nearYou"
                    ).replace(
                        "{city}",
                        shipment.match.city
                    )}
                </div>
            )}


            {/* ROUTE */}

            <div
                className="tayeb-route"
                style={{
                    marginTop:
                        "20px",
                }}
            >

                <div className="tayeb-route-point">

                    <span className="tayeb-route-label">
                        {t(
                            "shipper.pickupLocation"
                        )}
                    </span>

                    <div className="tayeb-route-city">
                        {
                            shipment.origin
                        }
                    </div>

                </div>

                <div className="tayeb-route-arrow">
                    →
                </div>

                <div className="tayeb-route-point">

                    <span className="tayeb-route-label">
                        {t(
                            "shipper.deliveryLocation"
                        )}
                    </span>

                    <div className="tayeb-route-city">
                        {
                            shipment.destination
                        }
                    </div>

                </div>

            </div>


            {/* DETAILS */}

            <div
                style={{
                    display:
                        "flex",
                    flexWrap:
                        "wrap",
                    gap:
                        "8px",
                    marginTop:
                        "16px",
                }}
            >

                <span className="tayeb-badge tayeb-badge-gray">
                    {t(
                        "common.quantity"
                    )}:{" "}
                    {
                        shipment.quantity
                    }
                </span>

                <span className="tayeb-badge tayeb-badge-orange">
                    {formatMoney(
                        shipment.initial_offer,
                        shipment.currency
                    )}
                </span>

                {shipment.route_km > 0 && (
                    <span className="tayeb-badge tayeb-badge-gray">
                        {t(
                            "driver.routeKm"
                        ).replace(
                            "{km}",
                            shipment.route_km
                        )}
                    </span>
                )}

                {shipment.from_km > 0 &&
                    !shipment.match && (
                        <span className="tayeb-badge tayeb-badge-gray">
                            {t(
                                "driver.kmFromYou"
                            ).replace(
                                "{km}",
                                shipment.from_km
                            )}
                        </span>
                    )}

            </div>


            {/* USUAL PRICE ON THIS ROUTE (real past deals) */}

            {shipment.price_hint && (
                <p
                    style={{
                        marginTop:
                            "10px",
                        color:
                            "#6b7280",
                        fontSize:
                            "13px",
                        fontWeight:
                            700,
                    }}
                >
                    💡{" "}
                    {t(
                        "common.usualPrice"
                    )
                        .replace(
                            "{low}",
                            formatMoney(
                                shipment.price_hint.low,
                                shipment.currency
                            )
                        )
                        .replace(
                            "{high}",
                            formatMoney(
                                shipment.price_hint.high,
                                shipment.currency
                            )
                        )
                        .replace(
                            "{count}",
                            shipment.price_hint.count
                        )}
                </p>
            )}


            {/* EXISTING BID */}

            {bid && (
                <div
                    style={{
                        marginTop:
                            "16px",
                        padding:
                            "15px",
                        borderRadius:
                            "17px",
                        background:
                            hasCounter
                                ? "#fff7ed"
                                : "#f9fafb",
                        border:
                            hasCounter
                                ? "1px solid #fed7aa"
                                : "1px solid #e5e7eb",
                    }}
                >

                    <span
                        style={{
                            display:
                                "block",
                            color:
                                "#9ca3af",
                            fontSize:
                                "11px",
                            fontWeight:
                                800,
                        }}
                    >
                        {hasCounter
                            ? t(
                                "driver.counterReceived"
                            )
                            : t(
                                "driver.yourPrice"
                            )}
                    </span>

                    <strong
                        style={{
                            display:
                                "block",
                            marginTop:
                                "4px",
                            color:
                                "#111827",
                            fontSize:
                                "18px",
                        }}
                    >
                        {formatMoney(
                            hasCounter
                                ? bid.counter_price
                                : bid.proposed_price,
                            shipment.currency
                        )}
                    </strong>

                    {bid.eta && (
                        <span
                            style={{
                                display:
                                    "block",
                                marginTop:
                                    "5px",
                                color:
                                    "#6b7280",
                                fontSize:
                                    "13px",
                            }}
                        >
                            {t(
                                "driver.arrivalTime"
                            )}
                            :{" "}
                            {
                                bid.eta
                            }
                        </span>
                    )}

                </div>
            )}


            {/* ACTIONS */}

            <div
                style={{
                    display:
                        "grid",
                    gridTemplateColumns:
                        bid
                            ? "1fr 1fr"
                            : "1fr",
                    gap:
                        "8px",
                    marginTop:
                        "17px",
                }}
            >

                <button
                    type="button"
                    onClick={
                        hasCounter
                            ? () =>
                                onCounter()
                            : onOffer
                    }
                    className="tayeb-button tayeb-button-primary"
                >
                    {hasCounter
                        ? t(
                            "driver.counterReceived"
                        )
                        : bid
                            ? t(
                                "driver.updateOffer"
                            )
                            : t(
                                "driver.sendOfferButton"
                            )}
                    →
                </button>

                {hasCounter && (
                    <button
                        type="button"
                        onClick={
                            onOffer
                        }
                        className="tayeb-button tayeb-button-light"
                    >
                        {t(
                            "driver.suggestPrice"
                        )}
                    </button>
                )}

            </div>

        </article>
    );
}


/* =========================================================
   ACTIVE DELIVERY
========================================================= */

function ActiveDelivery({
    shipment,
    t,
    formatPrice,
    updateStatus,
    statusLoading,
    tracking,
    retryTracking,
}) {
    const [deliveryCode, setDeliveryCode] =
        useState("");

    async function finishDelivery(
        event
    ) {
        event.preventDefault();

        const done =
            await updateStatus(
                shipment,
                "COMPLETED",
                deliveryCode
            );

        if (done) {
            setDeliveryCode("");
        }
    }

    return (
        <article className="tayeb-shipment-card">

            <div
                style={{
                    display:
                        "flex",
                    justifyContent:
                        "space-between",
                    alignItems:
                        "flex-start",
                    gap:
                        "15px",
                }}
            >

                <div>

                    <span className="tayeb-section-label">
                        {t(
                            "driver.currentDelivery"
                        )}
                    </span>

                    <h3
                        style={{
                            color:
                                "#111827",
                            fontSize:
                                "18px",
                            fontWeight:
                                900,
                        }}
                    >
                        {
                            shipment.item_type
                        }
                    </h3>

                </div>

                <span className="tayeb-badge tayeb-badge-orange">
                    {t(
                        `status.${String(
                            shipment.status ||
                            "pending"
                        ).toLowerCase()}`
                    )}
                </span>

            </div>


            <div
                className="tayeb-route"
                style={{
                    marginTop:
                        "20px",
                }}
            >

                <div className="tayeb-route-point">

                    <span className="tayeb-route-label">
                        {t(
                            "shipper.pickupLocation"
                        )}
                    </span>

                    <div className="tayeb-route-city">
                        {
                            shipment.origin
                        }
                    </div>

                </div>

                <div className="tayeb-route-arrow">
                    →
                </div>

                <div className="tayeb-route-point">

                    <span className="tayeb-route-label">
                        {t(
                            "shipper.deliveryLocation"
                        )}
                    </span>

                    <div className="tayeb-route-city">
                        {
                            shipment.destination
                        }
                    </div>

                </div>

            </div>


            <div
                style={{
                    display:
                        "flex",
                    flexWrap:
                        "wrap",
                    gap:
                        "8px",
                    marginTop:
                        "15px",
                }}
            >

                <span className="tayeb-badge tayeb-badge-orange">
                    {formatMoney(
                        shipment.agreed_price,
                        shipment.currency
                    )}
                </span>

                <span className="tayeb-badge tayeb-badge-gray">
                    {t(
                        "common.quantity"
                    )}:{" "}
                    {
                        shipment.quantity
                    }
                </span>

                {shipment.route_km > 0 && (
                    <span className="tayeb-badge tayeb-badge-gray">
                        {t(
                            "driver.routeKm"
                        ).replace(
                            "{km}",
                            shipment.route_km
                        )}
                    </span>
                )}

            </div>


            {/* PICKUP AT THE FARM (Tayeb Marché orders) */}

            {shipment.pickup_phone && (
                <div
                    style={{
                        marginTop:
                            "15px",
                        padding:
                            "14px",
                        borderRadius:
                            "16px",
                        background:
                            "#ecfdf5",
                        border:
                            "1px solid #bbf7d0",
                    }}
                >
                    <strong
                        style={{
                            display:
                                "block",
                            color:
                                "#166534",
                            fontSize:
                                "14px",
                        }}
                    >
                        🌾 {t(
                            "driver.pickupAtFarm"
                        )}
                        {shipment.pickup_name
                            ? ` · ${shipment.pickup_name}`
                            : ""}
                    </strong>

                    {shipment.details && (
                        <p
                            style={{
                                margin:
                                    "6px 0 0",
                                color:
                                    "#166534",
                                fontSize:
                                    "13px",
                                lineHeight:
                                    1.5,
                            }}
                        >
                            {
                                shipment.details
                            }
                        </p>
                    )}

                    <a
                        href={telHref(shipment.pickup_phone)}
                        className="tayeb-button tayeb-button-success tayeb-button-full"
                        style={{
                            marginTop:
                                "10px",
                            textDecoration:
                                "none",
                        }}
                    >
                        📞 {t(
                            "driver.callFarmer"
                        )}{" "}
                        · {formatPhone(shipment.pickup_phone)}
                    </a>
                </div>
            )}


            {/* RECEIVER */}

            {shipment.receiver_phone && (
                <a
                    href={telHref(shipment.receiver_phone)}
                    className="tayeb-button tayeb-button-light tayeb-button-full"
                    style={{
                        marginTop:
                            "15px",
                        textDecoration:
                            "none",
                    }}
                >
                    📞{" "}
                    {t(
                        "driver.callReceiver"
                    )}{" "}
                    · {formatPhone(shipment.receiver_phone)}
                </a>
            )}


            {/* SHIPPER INFO */}

            {shipment.shipper && (
                <div
                    style={{
                        marginTop:
                            "18px",
                        padding:
                            "15px",
                        background:
                            "#fff7ed",
                        border:
                            "1px solid #fed7aa",
                        borderRadius:
                            "17px",
                    }}
                >

                    <strong
                        style={{
                            display:
                                "block",
                            color:
                                "#111827",
                            fontSize:
                                "14px",
                        }}
                    >
                        {t(
                            "driver.shipperInformation"
                        )}
                    </strong>

                    <div
                        style={{
                            display:
                                "grid",
                            gridTemplateColumns:
                                "1fr 1fr",
                            gap:
                                "8px",
                            marginTop:
                                "10px",
                        }}
                    >

                        <InfoBox
                            label={
                                t(
                                    "common.name"
                                )
                            }
                            value={
                                shipment
                                    .shipper
                                    .full_name ||
                                "—"
                            }
                        />

                        <InfoBox
                            label={
                                t(
                                    "common.phone"
                                )
                            }
                            value={
                                shipment
                                    .shipper
                                    .phone_number ? (
                                    <a
                                        href={telHref(shipment.shipper.phone_number)}
                                        style={{
                                            color:
                                                "#ea580c",
                                        }}
                                    >
                                        {formatPhone(shipment.shipper.phone_number)}
                                    </a>
                                ) : (
                                    "—"
                                )
                            }
                        />

                    </div>

                </div>
            )}


            {/* LIVE LOCATION */}

            {shipment.status ===
                "DEPARTED" && (
                    <div
                        style={{
                            marginTop:
                                "15px",
                            padding:
                                "12px 14px",
                            borderRadius:
                                "14px",
                            background:
                                tracking ===
                                    "on"
                                    ? "#f0fdf4"
                                    : "#fffbeb",
                            color:
                                tracking ===
                                    "on"
                                    ? "#166534"
                                    : "#92400e",
                            fontSize:
                                "14px",
                            fontWeight:
                                700,
                            lineHeight:
                                1.45,
                        }}
                    >
                        {tracking === "on"
                            ? t(
                                "driver.sharingLocation"
                            )
                            : tracking ===
                                "denied"
                                ? t(
                                    "driver.locationBlocked"
                                )
                                : t(
                                    "driver.locationOff"
                                )}

                        {tracking !==
                            "on" && (
                                <button
                                    type="button"
                                    onClick={
                                        retryTracking
                                    }
                                    className="tayeb-button tayeb-button-light"
                                    style={{
                                        display:
                                            "flex",
                                        marginTop:
                                            "10px",
                                    }}
                                >
                                    📡{" "}
                                    {t(
                                        "driver.shareLocation"
                                    )}
                                </button>
                            )}
                    </div>
                )}


            {/* DELIVERY BUTTON */}

            <div
                style={{
                    marginTop:
                        "17px",
                }}
            >

                {shipment.status ===
                    "MATCHED" && (
                        <button
                            type="button"
                            onClick={() =>
                                updateStatus(
                                    shipment,
                                    "DEPARTED"
                                )
                            }
                            disabled={
                                statusLoading
                            }
                            className="tayeb-button tayeb-button-primary tayeb-button-full"
                        >
                            🚚{" "}
                            {t(
                                "driver.startDelivery"
                            )}
                        </button>
                    )}


                {shipment.status ===
                    "DEPARTED" && (
                        <button
                            type="button"
                            onClick={() =>
                                updateStatus(
                                    shipment,
                                    "ARRIVED"
                                )
                            }
                            disabled={
                                statusLoading
                            }
                            className="tayeb-button tayeb-button-primary tayeb-button-full"
                        >
                            📍{" "}
                            {t(
                                "driver.arrived"
                            )}
                        </button>
                    )}


                {/* FINISH: needs the receiver's code */}

                {shipment.status ===
                    "ARRIVED" &&
                    shipment.code_locked && (
                        <div
                            style={{
                                padding:
                                    "13px",
                                borderRadius:
                                    "14px",
                                background:
                                    "#fef2f2",
                                color:
                                    "#991b1b",
                                fontSize:
                                    "14px",
                                fontWeight:
                                    700,
                            }}
                        >
                            {t(
                                "driver.codeLocked"
                            )}
                        </div>
                    )}

                {shipment.status ===
                    "ARRIVED" &&
                    !shipment.code_locked && (
                        <form
                            onSubmit={
                                finishDelivery
                            }
                        >

                            {shipment.needs_code && (
                                <div className="tayeb-form-group">

                                    <label
                                        className="tayeb-label"
                                        htmlFor={`code-${shipment.id}`}
                                    >
                                        {t(
                                            "driver.deliveryCode"
                                        )}
                                    </label>

                                    <input
                                        id={`code-${shipment.id}`}
                                        className="tayeb-input"
                                        value={
                                            deliveryCode
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setDeliveryCode(
                                                event.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 4)
                                            )
                                        }
                                        inputMode="numeric"
                                        placeholder="0000"
                                        required
                                        style={{
                                            fontSize:
                                                "22px",
                                            letterSpacing:
                                                "0.4em",
                                            textAlign:
                                                "center",
                                            fontWeight:
                                                900,
                                        }}
                                    />

                                    <p
                                        style={{
                                            marginTop:
                                                "7px",
                                            color:
                                                "#6b7280",
                                            fontSize:
                                                "13px",
                                        }}
                                    >
                                        {t(
                                            "driver.deliveryCodeHint"
                                        )}
                                    </p>

                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    statusLoading ||
                                    (shipment.needs_code &&
                                        deliveryCode.length !==
                                        4)
                                }
                                className="tayeb-button tayeb-button-success tayeb-button-full"
                            >
                                ✓{" "}
                                {t(
                                    "driver.completeDelivery"
                                )}
                            </button>

                        </form>
                    )}

            </div>

        </article>
    );
}


/* =========================================================
   INFO BOX
========================================================= */

function InfoBox({
    label,
    value,
}) {
    return (
        <div
            style={{
                padding:
                    "10px",
                borderRadius:
                    "12px",
                background:
                    "rgba(255,255,255,0.75)",
            }}
        >

            <span
                style={{
                    display:
                        "block",
                    color:
                        "#9ca3af",
                    fontSize:
                        "11px",
                    fontWeight:
                        800,
                    marginBottom:
                        "3px",
                }}
            >
                {label}
            </span>

            <strong
                style={{
                    display:
                        "block",
                    color:
                        "#374151",
                    fontSize:
                        "13px",
                    wordBreak:
                        "break-word",
                }}
            >
                {value}
            </strong>

        </div>
    );
}


/* =========================================================
   MODAL
========================================================= */

function ModalOverlay({
    children,
    onClose,
}) {
    return (
        <div
            style={{
                position:
                    "fixed",
                inset:
                    0,
                zIndex:
                    1000,
                display:
                    "flex",
                alignItems:
                    "center",
                justifyContent:
                    "center",
                padding:
                    "20px",
                background:
                    "rgba(17,24,39,0.55)",
                backdropFilter:
                    "blur(8px)",
            }}
            onMouseDown={(
                event
            ) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >

            <div
                className="tayeb-card tayeb-fade-in"
                style={{
                    width:
                        "min(520px, 100%)",
                    maxHeight:
                        "90vh",
                    overflowY:
                        "auto",
                    padding:
                        "25px",
                }}
            >

                <div
                    style={{
                        display:
                            "flex",
                        justifyContent:
                            "flex-end",
                        marginBottom:
                            "5px",
                    }}
                >

                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                        style={{
                            width:
                                "36px",
                            height:
                                "36px",
                            border:
                                "1px solid #e5e7eb",
                            borderRadius:
                                "12px",
                            background:
                                "white",
                            color:
                                "#6b7280",
                            cursor:
                                "pointer",
                            fontSize:
                                "17px",
                        }}
                    >
                        ×
                    </button>

                </div>

                {children}

            </div>

        </div>
    );
}