import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import supabase from "../lib/supabaseClient";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";
import Notifications from "../components/Notifications";
import DeleteAccount from "../components/Account/DeleteAccount";

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

    /* =========================================================
       LOAD DRIVER
    ========================================================= */

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        async function restoreSession() {
            try {
                const response = await fetch(
                    "/api/session/me",
                    {
                        method: "GET",
                        credentials: "include",
                    }
                );

                if (!response.ok) {
                    localStorage.removeItem(
                        "tayebUser"
                    );

                    localStorage.removeItem(
                        "selectedRole"
                    );

                    router.replace("/login");
                    return;
                }

                const result =
                    await response.json();

                if (
                    !result.authenticated ||
                    !result.user ||
                    !result.user.id ||
                    result.user.role !== "DRIVER"
                ) {
                    localStorage.removeItem(
                        "tayebUser"
                    );

                    localStorage.removeItem(
                        "selectedRole"
                    );

                    router.replace("/login");
                    return;
                }

                /*
                 * Server session is the
                 * authentication authority.
                 */

                setUser(result.user);

                /*
                 * Keep localStorage as a
                 * compatibility cache for
                 * the existing Driver code.
                 */

                localStorage.setItem(
                    "tayebUser",
                    JSON.stringify(
                        result.user
                    )
                );

                localStorage.setItem(
                    "selectedRole",
                    result.user.role
                );

                loadDriverData(
                    result.user
                );

            } catch (error) {
                console.error(
                    "Could not restore Tayeb session:",
                    error
                );

                localStorage.removeItem(
                    "tayebUser"
                );

                localStorage.removeItem(
                    "selectedRole"
                );

                router.replace("/login");
            }
        }

        restoreSession();

    }, [router]);


    /* =========================================================
       REALTIME
    ========================================================= */

    useEffect(() => {
        if (!user?.id) return;

        const shipmentChannel =
            supabase
                .channel(
                    `tayeb-driver-shipments-${user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "shipments",
                    },
                    () => {
                        fetchShipments(
                            user.id
                        );
                    }
                )
                .subscribe();

        const bidChannel =
            supabase
                .channel(
                    `tayeb-driver-bids-${user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "bids",
                        filter: `driver_id=eq.${user.id}`,
                    },
                    () => {
                        fetchShipments(
                            user.id
                        );
                    }
                )
                .subscribe();

        return () => {
            supabase.removeChannel(
                shipmentChannel
            );

            supabase.removeChannel(
                bidChannel
            );
        };
    }, [user]);


    /* =========================================================
       LOAD DRIVER DATA
    ========================================================= */

    async function loadDriverData(
        currentUser
    ) {
        try {
            const {
                data,
                error,
            } = await supabase
                .from("users")
                .select("*")
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();

            if (
                !error &&
                data
            ) {
                setAvailable(
                    data.is_available ??
                    true
                );

                setUser(data);

                localStorage.setItem(
                    "tayebUser",
                    JSON.stringify(data)
                );
            }
        } catch (error) {
            console.error(
                "Driver profile error:",
                error
            );
        }

        fetchShipments(
            currentUser.id
        );
    }


    /* =========================================================
       FETCH SHIPMENTS
    ========================================================= */

    async function fetchShipments(
        driverId
    ) {
        setLoading(true);

        try {
            const {
                data,
                error,
            } = await supabase
                .from("shipments")
                .select(`
                    *,
                    shipper:shipper_id (
                        id,
                        full_name,
                        phone_number
                    ),
                    driver:driver_id (
                        id,
                        full_name,
                        phone_number,
                        profile_photo,
                        vehicle_type,
                        vehicle_number,
                        plate_number,
                        rating,
                        total_completed_shipments
                    )
                `)
                .or(
                    `status.eq.OPEN,driver_id.eq.${driverId}`
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                );

            if (error) {
                throw error;
            }

            const safeShipments =
                data || [];

            setShipments(
                safeShipments
            );

            const {
                data: bids,
                error: bidsError,
            } = await supabase
                .from("bids")
                .select(`
                    id,
                    shipment_id,
                    driver_id,
                    proposed_price,
                    counter_price,
                    last_offer_by,
                    status,
                    created_at,
                    eta,
                    note
                `)
                .eq(
                    "driver_id",
                    driverId
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false,
                    }
                );

            if (bidsError) {
                console.log(
                    "Driver bids error:",
                    bidsError
                );
            }

            setDriverBids(
                bids || []
            );
        } catch (error) {
            console.error(
                "Fetch driver shipments error:",
                error
            );
        } finally {
            setLoading(false);
        }
    }


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
       SEND FIRST OFFER
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
            const {
                data: newBid,
                error,
            } = await supabase
                .from("bids")
                .insert([
                    {
                        shipment_id:
                            selectedShipment.id,

                        driver_id:
                            user.id,

                        proposed_price:
                            price,

                        counter_price:
                            null,

                        last_offer_by:
                            "DRIVER",

                        eta:
                            offerTime.trim() ||
                            null,

                        note:
                            offerNote.trim() ||
                            null,

                        status:
                            "PENDING",
                    },
                ])
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            console.log(
                "New bid:",
                newBid
            );

            /* ---------------------------------------------
               NOTIFY SHIPPER
            --------------------------------------------- */

            try {
                await fetch(
                    "/api/send-notification",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    shipmentId:
                                        selectedShipment.id,

                                    eventType:
                                        "BID_RECEIVED",

                                    targetUserId:
                                        selectedShipment.shipper_id,
                                }
                            ),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Bid notification error:",
                    notificationError
                );
            }

            setOfferPrice("");
            setOfferTime("");
            setOfferNote("");

            setShowOfferForm(
                false
            );

            setSelectedShipment(
                null
            );

            await fetchShipments(
                user.id
            );

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

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
        } finally {
            setSubmittingOffer(
                false
            );
        }
    }


    /* =========================================================
       ACCEPT COUNTER PRICE
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

        const finalPrice =
            Number(
                bid.counter_price
            );

        if (
            !finalPrice ||
            finalPrice <= 0
        ) {
            alert(
                t(
                    "errors.invalidPrice"
                )
            );

            return;
        }

        try {
            /*
             * Only accept if the shipment
             * is still open.
             */

            const {
                data:
                updatedShipment,
                error:
                shipmentError,
            } = await supabase
                .from("shipments")
                .update({
                    driver_id:
                        user.id,

                    driver_name:
                        user.full_name,

                    driver_phone:
                        user.phone_number,

                    agreed_price:
                        finalPrice,

                    status:
                        "MATCHED",

                    matched_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    bid.shipment_id
                )
                .eq(
                    "status",
                    "OPEN"
                )
                .select("*")
                .maybeSingle();

            if (shipmentError) {
                throw shipmentError;
            }

            if (
                !updatedShipment
            ) {
                alert(
                    "This cargo is no longer available."
                );

                await fetchShipments(
                    user.id
                );

                return;
            }


            /*
             * Accept this bid.
             */

            const {
                error:
                bidError,
            } = await supabase
                .from("bids")
                .update({
                    proposed_price:
                        finalPrice,

                    counter_price:
                        null,

                    last_offer_by:
                        "DRIVER",

                    status:
                        "ACCEPTED",
                })
                .eq(
                    "id",
                    bid.id
                )
                .eq(
                    "driver_id",
                    user.id
                );

            if (bidError) {
                throw bidError;
            }


            /*
             * Reject other offers.
             */

            const {
                error:
                rejectError,
            } = await supabase
                .from("bids")
                .update({
                    status:
                        "REJECTED",
                })
                .eq(
                    "shipment_id",
                    bid.shipment_id
                )
                .neq(
                    "id",
                    bid.id
                );

            if (
                rejectError
            ) {
                console.log(
                    "Other bids rejection error:",
                    rejectError
                );
            }


            /*
             * Notify shipper.
             */

            try {
                await fetch(
                    "/api/send-notification",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    shipmentId:
                                        bid.shipment_id,

                                    eventType:
                                        "MATCHED",

                                    targetUserId:
                                        updatedShipment.shipper_id,
                                }
                            ),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Matched notification error:",
                    notificationError
                );
            }

            await fetchShipments(
                user.id
            );

            setCounterBid(
                null
            );

            setCounterPrice(
                ""
            );

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

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
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
            const {
                error,
            } = await supabase
                .from("bids")
                .update({
                    counter_price:
                        price,

                    last_offer_by:
                        "DRIVER",

                    status:
                        "COUNTERED",
                })
                .eq(
                    "id",
                    bid.id
                )
                .eq(
                    "driver_id",
                    user.id
                );

            if (error) {
                throw error;
            }


            /*
             * Notify shipper.
             */

            try {
                const shipment =
                    shipments.find(
                        (item) =>
                            item.id ===
                            bid.shipment_id
                    );

                await fetch(
                    "/api/send-notification",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    shipmentId:
                                        bid.shipment_id,

                                    eventType:
                                        "COUNTER_OFFER",

                                    targetUserId:
                                        shipment?.shipper_id,
                                }
                            ),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Counter notification error:",
                    notificationError
                );
            }

            setCounterPrice(
                ""
            );

            setCounterBid(
                null
            );

            await fetchShipments(
                user.id
            );

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

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
        } finally {
            setCounterLoading(
                false
            );
        }
    }


    /* =========================================================
       AVAILABILITY
    ========================================================= */

    async function toggleAvailability() {
        if (!user) {
            return;
        }

        const newStatus =
            !available;

        try {
            const {
                error,
            } = await supabase
                .from("users")
                .update({
                    is_available:
                        newStatus,

                    last_seen:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    user.id
                );

            if (error) {
                throw error;
            }

            setAvailable(
                newStatus
            );

            const updatedUser = {
                ...user,
                is_available:
                    newStatus,
                last_seen:
                    new Date().toISOString(),
            };

            setUser(
                updatedUser
            );

            localStorage.setItem(
                "tayebUser",
                JSON.stringify(
                    updatedUser
                )
            );
        } catch (error) {
            console.error(
                "Availability error:",
                error
            );

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
        }
    }


    /* =========================================================
       DELIVERY STATUS
    ========================================================= */

    async function updateStatus(
        shipment,
        status
    ) {
        if (
            !user ||
            !shipment
        ) {
            return;
        }

        /*
         * Only the selected driver
         * can move an assigned shipment.
         */

        if (
            shipment.driver_id !==
            user.id &&
            status !==
            "MATCHED"
        ) {
            return;
        }

        const updates = {
            status,
        };

        const now =
            new Date().toISOString();

        if (
            status ===
            "MATCHED"
        ) {
            updates.driver_id =
                user.id;

            updates.driver_name =
                user.full_name;

            updates.driver_phone =
                user.phone_number;

            updates.matched_at =
                now;
        }

        if (
            status ===
            "DEPARTED"
        ) {
            updates.departed_at =
                now;
        }

        if (
            status ===
            "ARRIVED"
        ) {
            updates.arrived_at =
                now;
        }

        if (
            status ===
            "COMPLETED"
        ) {
            updates.completed_at =
                now;
        }

        try {
            const {
                error,
            } = await supabase
                .from("shipments")
                .update(updates)
                .eq(
                    "id",
                    shipment.id
                )
                .eq(
                    "driver_id",
                    user.id
                );

            if (error) {
                throw error;
            }


            /*
             * Notify shipper.
             */

            try {
                await fetch(
                    "/api/send-notification",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    shipmentId:
                                        shipment.id,

                                    eventType:
                                        status,

                                    targetUserId:
                                        shipment.shipper_id,
                                }
                            ),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Delivery notification error:",
                    notificationError
                );
            }


            /*
             * Refresh.
             */

            await fetchShipments(
                user.id
            );

            /*
             * When completed, make
             * driver available again.
             */

            if (
                status ===
                "COMPLETED"
            ) {
                try {
                    await supabase
                        .from("users")
                        .update({
                            is_available:
                                true,

                            last_seen:
                                new Date().toISOString(),
                        })
                        .eq(
                            "id",
                            user.id
                        );

                    setAvailable(
                        true
                    );
                } catch (
                availabilityError
                ) {
                    console.log(
                        "Availability reset error:",
                        availabilityError
                    );
                }
            }
        } catch (error) {
            console.error(
                "Delivery status error:",
                error
            );

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
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
            localStorage.removeItem(
                "tayebUser"
            );

            localStorage.removeItem(
                "selectedRole"
            );

            router.replace(
                "/login"
            );
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

                <div
                    style={{
                        background: "#fff7ed",
                        border: "2px solid #f97316",
                        padding: "20px",
                        margin: "30px 0",
                        borderRadius: "20px",
                    }}
                >
                    DELETE ACCOUNT TEST
                </div>

                <DeleteAccount user={user} />
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
                                        "9px",
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
                                        "9px",
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
                                        "13px",
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
                                                "10px",
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
                                                onOffer={() => {
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
                                                }}
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
                                                    "9px",
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
                                            {formatPrice(
                                                selectedShipment.initial_offer
                                            )}{" "}
                                            FCFA
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
                                                        "10px",
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
                                                "9px",
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
                                        {formatPrice(
                                            counterBid.counter_price
                                        )}{" "}
                                        FCFA
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
                                                                    "13px",
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
                                                                    "10px",
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
                                    "9px",
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
                                "9px",
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
                    {formatPrice(
                        shipment.initial_offer
                    )}{" "}
                    FCFA
                </span>

            </div>


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
                                "8px",
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
                        {formatPrice(
                            hasCounter
                                ? bid.counter_price
                                : bid.proposed_price
                        )}{" "}
                        FCFA
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
                                    "10px",
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
}) {
    const driver =
        shipment.driver;

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
                    {formatPrice(
                        shipment.agreed_price
                    )}{" "}
                    FCFA
                </span>

                <span className="tayeb-badge tayeb-badge-gray">
                    {t(
                        "common.quantity"
                    )}:{" "}
                    {
                        shipment.quantity
                    }
                </span>

            </div>


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
                                "12px",
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
                                    .phone_number ||
                                "—"
                            }
                        />

                    </div>

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
                            className="tayeb-button tayeb-button-primary tayeb-button-full"
                        >
                            📍{" "}
                            {t(
                                "driver.arrived"
                            )}
                        </button>
                    )}


                {shipment.status ===
                    "ARRIVED" && (
                        <button
                            type="button"
                            onClick={() =>
                                updateStatus(
                                    shipment,
                                    "COMPLETED"
                                )
                            }
                            className="tayeb-button tayeb-button-success tayeb-button-full"
                        >
                            ✓{" "}
                            {t(
                                "driver.completeDelivery"
                            )}
                        </button>
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
                        "8px",
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
                        "10px",
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