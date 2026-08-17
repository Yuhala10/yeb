import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import supabase from "../lib/supabaseClient";
import BrandLogo from "../components/BrandLogo";
import Notifications from "../components/Notifications";
import { useLanguage } from "../lib/LanguageContext";
import DeleteAccount from "../components/Account/DeleteAccount";

export default function ShipperPage() {
    const router = useRouter();

    const {
        t,
        language,
        setLanguage,
    } = useLanguage();

    const [user, setUser] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [bids, setBids] = useState([]);

    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);

    const [showPostForm, setShowPostForm] =
        useState(false);

    const [selectedBid, setSelectedBid] =
        useState(null);

    const [counterPrice, setCounterPrice] =
        useState("");

    const [counterLoading, setCounterLoading] =
        useState(false);

    const [cargo, setCargo] = useState({
        itemType: "Bags/Sacks",
        origin: "",
        destination: "",
        quantity: "",
        price: "",
        receiverPhone: "",
    });

    /* =========================================================
       LOAD USER
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
                    result.user.role !== "SHIPPER"
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
                 * The server session is the
                 * authentication authority.
                 */

                setUser(result.user);

                /*
                 * Keep localStorage updated because
                 * the existing Shipper dashboard
                 * still uses tayebUser in other places.
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

                /*
                 * Load this user's shipments.
                 */

                loadShipments(
                    result.user.id
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
       LOAD SHIPMENTS + BIDS
    ========================================================= */



    async function loadShipments(shipperId) {
        setLoading(true);

        try {
            const {
                data: shipmentData,
                error: shipmentError,
            } = await supabase
                .from("shipments")
                .select(`
                    *,
                    driver:driver_id (
                        id,
                        full_name,
                        phone_number,
                        profile_photo,
                        vehicle_type,
                        vehicle_number,
                        plate_number,
                        rating,
                        total_completed_shipments,
                        is_available
                    )
                `)
                .eq(
                    "shipper_id",
                    shipperId
                )
                .order("created_at", {
                    ascending: false,
                });

            if (shipmentError) {
                throw shipmentError;
            }

            const safeShipments =
                shipmentData || [];

            setShipments(
                safeShipments
            );

            const ids =
                safeShipments.map(
                    (item) => item.id
                );

            if (ids.length === 0) {
                setBids([]);
                return;
            }

            const {
                data: bidData,
                error: bidError,
            } = await supabase
                .from("bids")
                .select(`
                    *,
                    driver:driver_id (
                        id,
                        full_name,
                        phone_number,
                        profile_photo,
                        vehicle_type,
                        vehicle_number,
                        plate_number,
                        rating,
                        total_completed_shipments,
                        is_available
                    )
                `)
                .in(
                    "shipment_id",
                    ids
                )
                .order("created_at", {
                    ascending: true,
                });

            if (bidError) {
                throw bidError;
            }

            setBids(
                bidData || []
            );
        } catch (error) {
            console.error(
                "Tayeb shipment loading error:",
                error
            );

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
        } finally {
            setLoading(false);
        }
    }


    /* =========================================================
       PRICE CLEANING
    ========================================================= */

    function cleanPrice(value) {
        return String(value || "")
            .replace(/[^\d]/g, "");
    }


    function formatPrice(value) {
        const number =
            Number(value);

        if (
            !Number.isFinite(number)
        ) {
            return "0";
        }

        return number.toLocaleString(
            "en-US"
        );
    }


    /* =========================================================
       FORM CHANGE
    ========================================================= */

    function updateCargo(
        field,
        value
    ) {
        setCargo((current) => ({
            ...current,
            [field]:
                field === "price"
                    ? cleanPrice(value)
                    : value,
        }));
    }


    /* =========================================================
       POST CARGO
    ========================================================= */

    async function handlePostCargo(
        event
    ) {
        event.preventDefault();

        if (!user) return;

        const allowedItemTypes = [
            "Bags/Sacks",
            "Crates/Boxes",
            "Drums/Oil",
            "Furniture/Bulky",
        ];

        if (!allowedItemTypes.includes(cargo.itemType)) {
            alert(
                language === "fr"
                    ? "Veuillez sélectionner une catégorie de cargaison valide."
                    : "Please select a valid cargo category."
            );

            return;
        }

        const itemType =
            cargo.itemType.trim();

        const origin =
            cargo.origin.trim();

        const destination =
            cargo.destination.trim();

        const quantity =
            Number(cargo.quantity);

        const price =
            Number(
                cleanPrice(
                    cargo.price
                )
            );

        const receiverPhone =
            cargo.receiverPhone.trim();

        if (
            !itemType ||
            !origin ||
            !destination ||
            !quantity ||
            quantity <= 0 ||
            !price ||
            price <= 0
        ) {
            alert(
                t(
                    "errors.required"
                )
            );

            return;
        }

        setPosting(true);

        try {
            const {
                data,
                error,
            } = await supabase
                .from("shipments")
                .insert([
                    {
                        shipper_id:
                            user.id,

                        shipper_name:
                            user.full_name,

                        shipper_phone:
                            user.phone_number,

                        item_type:
                            itemType,

                        origin,

                        destination,

                        quantity,

                        initial_offer:
                            price,

                        receiver_phone:
                            receiverPhone ||
                            null,

                        status:
                            "OPEN",
                    },
                ])
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            setCargo({
                itemType: "Bags/Sacks",
                origin: "",
                destination: "",
                quantity: "",
                price: "",
                receiverPhone: "",
            });

            setShowPostForm(false);

            await loadShipments(
                user.id
            );

            alert(
                t(
                    "shipper.shipmentPosted"
                )
            );

            /*
             * Tell available drivers that
             * new cargo is available.
             *
             * The notification API can later
             * be connected to the matching
             * system for location-based delivery.
             */
            if (data?.id) {
                try {
                    await fetch(
                        "/api/send-notification",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                shipmentId:
                                    data.id,

                                eventType:
                                    "NEW_SHIPMENT",
                            }),
                        }
                    );
                } catch (
                notificationError
                ) {
                    console.log(
                        "New shipment notification error:",
                        notificationError
                    );
                }
            }
        } catch (error) {
            console.error(
                "Post cargo error:",
                error
            );

            alert(
                error?.message ||
                t(
                    "errors.somethingWrong"
                )
            );
        } finally {
            setPosting(false);
        }
    }


    /* =========================================================
       ACCEPT DRIVER OFFER
    ========================================================= */

    async function acceptBid(
        bid
    ) {
        if (!user || !bid) {
            return;
        }

        const finalPrice =
            Number(
                bid.counter_price ??
                bid.proposed_price
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
            const {
                error:
                shipmentError,
            } = await supabase
                .from("shipments")
                .update({
                    driver_id:
                        bid.driver_id,

                    driver_name:
                        bid.driver?.full_name ||
                        null,

                    driver_phone:
                        bid.driver?.phone_number ||
                        null,

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
                    "shipper_id",
                    user.id
                )
                .eq(
                    "status",
                    "OPEN"
                );

            if (shipmentError) {
                throw shipmentError;
            }

            const {
                error: bidError,
            } = await supabase
                .from("bids")
                .update({
                    proposed_price:
                        finalPrice,

                    counter_price:
                        null,

                    last_offer_by:
                        "SHIPPER",

                    status:
                        "ACCEPTED",
                })
                .eq(
                    "id",
                    bid.id
                )
                .eq(
                    "shipment_id",
                    bid.shipment_id
                );

            if (bidError) {
                throw bidError;
            }

            /*
             * Reject the other offers.
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

            if (rejectError) {
                console.log(
                    "Other bids rejection error:",
                    rejectError
                );
            }


            /*
             * Tell the selected driver.
             */

            try {
                await fetch(
                    "/api/send-notification",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            shipmentId:
                                bid.shipment_id,

                            eventType:
                                "DRIVER_SELECTED",

                            targetUserId:
                                bid.driver_id,
                        }),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Driver selected notification error:",
                    notificationError
                );
            }


            /*
             * Tell the other drivers
             * they were not selected.
             */

            try {
                const {
                    data:
                    otherBids,
                } = await supabase
                    .from("bids")
                    .select(
                        "driver_id"
                    )
                    .eq(
                        "shipment_id",
                        bid.shipment_id
                    )
                    .neq(
                        "id",
                        bid.id
                    );

                if (
                    otherBids &&
                    otherBids.length
                ) {
                    await Promise.all(
                        otherBids.map(
                            async (
                                otherBid
                            ) => {
                                try {
                                    await fetch(
                                        "/api/send-notification",
                                        {
                                            method:
                                                "POST",

                                            headers:
                                            {
                                                "Content-Type":
                                                    "application/json",
                                            },

                                            body:
                                                JSON.stringify(
                                                    {
                                                        shipmentId:
                                                            bid.shipment_id,

                                                        eventType:
                                                            "DRIVER_NOT_SELECTED",

                                                        targetUserId:
                                                            otherBid.driver_id,
                                                    }
                                                ),
                                        }
                                    );
                                } catch (
                                notificationError
                                ) {
                                    console.log(
                                        "Other driver notification error:",
                                        notificationError
                                    );
                                }
                            }
                        )
                    );
                }
            } catch (
            notificationError
            ) {
                console.log(
                    "Could not notify other drivers:",
                    notificationError
                );
            }

            await loadShipments(
                user.id
            );

            setSelectedBid(
                null
            );

            alert(
                t(
                    "shipper.offerAccepted"
                )
            );
        } catch (error) {
            console.error(
                "Accept bid error:",
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
       SUGGEST ANOTHER PRICE
    ========================================================= */

    async function suggestAnotherPrice(
        bid
    ) {
        if (!user || !bid) {
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

        setCounterLoading(true);

        try {
            const {
                error,
            } = await supabase
                .from("bids")
                .update({
                    counter_price:
                        price,

                    last_offer_by:
                        "SHIPPER",

                    status:
                        "COUNTERED",
                })
                .eq(
                    "id",
                    bid.id
                )
                .eq(
                    "shipment_id",
                    bid.shipment_id
                );

            if (error) {
                throw error;
            }


            /*
             * Notify the driver.
             */

            try {
                await fetch(
                    "/api/send-notification",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            shipmentId:
                                bid.shipment_id,

                            eventType:
                                "COUNTER_OFFER",

                            targetUserId:
                                bid.driver_id,
                        }),
                    }
                );
            } catch (
            notificationError
            ) {
                console.log(
                    "Counter-price notification error:",
                    notificationError
                );
            }

            setCounterPrice("");

            setSelectedBid(
                null
            );

            await loadShipments(
                user.id
            );

            alert(
                t(
                    "shipper.counterSent"
                )
            );
        } catch (error) {
            console.error(
                "Counter offer error:",
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
       UPDATE DELIVERY STATUS
    ========================================================= */

    async function updateShipmentStatus(
        shipment,
        status
    ) {
        if (
            !user ||
            !shipment?.id
        ) {
            return;
        }

        const updates = {
            status,
        };

        const now =
            new Date().toISOString();

        if (
            status === "MATCHED"
        ) {
            updates.matched_at =
                now;
        }

        if (
            status === "DEPARTED"
        ) {
            updates.departed_at =
                now;
        }

        if (
            status === "ARRIVED"
        ) {
            updates.arrived_at =
                now;
        }

        if (
            status === "COMPLETED"
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
                    "shipper_id",
                    user.id
                );

            if (error) {
                throw error;
            }

            await loadShipments(
                user.id
            );
        } catch (error) {
            console.error(
                "Shipment status error:",
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

    async function handleLogout() {
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
       GROUP DATA
    ========================================================= */

    const activeShipments =
        useMemo(
            () =>
                shipments.filter(
                    (shipment) =>
                        shipment.status !==
                        "COMPLETED" &&
                        shipment.status !==
                        "CANCELLED"
                ),
            [shipments]
        );

    const completedShipments =
        useMemo(
            () =>
                shipments.filter(
                    (shipment) =>
                        shipment.status ===
                        "COMPLETED"
                ),
            [shipments]
        );


    function shipmentBids(
        shipmentId
    ) {
        return bids.filter(
            (bid) =>
                bid.shipment_id ===
                shipmentId
        );
    }


    /* =========================================================
       STATUS TEXT
    ========================================================= */

    function statusText(
        status
    ) {
        const keyMap = {
            OPEN:
                "status.open",

            PENDING:
                "status.pending",

            COUNTERED:
                "status.countered",

            ACCEPTED:
                "status.accepted",

            MATCHED:
                "status.matched",

            DEPARTED:
                "status.departed",

            ARRIVED:
                "status.arrived",

            COMPLETED:
                "status.completed",

            CANCELLED:
                "status.cancelled",
        };

        return t(
            keyMap[status] ||
            "common.status"
        );
    }


    function statusClass(
        status
    ) {
        if (
            status ===
            "COMPLETED"
        ) {
            return "tayeb-badge tayeb-badge-success";
        }

        if (
            status ===
            "CANCELLED"
        ) {
            return "tayeb-badge tayeb-badge-danger";
        }

        if (
            status ===
            "MATCHED" ||
            status ===
            "DEPARTED" ||
            status ===
            "ARRIVED"
        ) {
            return "tayeb-badge tayeb-badge-orange";
        }

        return "tayeb-badge tayeb-badge-gray";
    }


    /* =========================================================
       LOADING
    ========================================================= */

    if (
        !user ||
        loading
    ) {
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
                <div
                    style={{
                        textAlign:
                            "center",
                    }}
                >
                    <BrandLogo
                        width={130}
                        height={48}
                    />

                    <div
                        style={{
                            marginTop:
                                "25px",
                        }}
                    >
                        <span className="tayeb-spinner tayeb-spinner-orange" />
                    </div>

                    <p
                        style={{
                            marginTop:
                                "15px",
                            color:
                                "#6b7280",
                            fontSize:
                                "12px",
                        }}
                    >
                        {t(
                            "common.loading"
                        )}
                    </p>
                </div>
            </main>
        );
    }


    return (
        <>
            <Head>
                <title>
                    Tayeb —{" "}
                    {t(
                        "shipper.dashboard"
                    )}
                </title>

                <meta
                    name="description"
                    content={t(
                        "shipper.dashboard"
                    )}
                />
            </Head>


            <main className="tayeb-app">

                {/* =================================================
                    TOP BAR
                ================================================= */}

                <header className="tayeb-topbar">

                    <div className="tayeb-topbar-left">

                        <BrandLogo
                            width={105}
                            height={40}
                        />

                        <div
                            style={{
                                display:
                                    "none",
                            }}
                            className="shipper-desktop-title"
                        >
                            <strong>
                                {t(
                                    "shipper.dashboard"
                                )}
                            </strong>
                        </div>

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


                        {/* USER */}

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
                                "T"}
                        </div>

                    </div>

                </header>


                {/* =================================================
                    MAIN CONTENT
                ================================================= */}

                <div className="tayeb-dashboard">

                    {/* WELCOME */}

                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "flex-end",
                            justifyContent:
                                "space-between",
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
                                    "shipper.greeting"
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
                                    "shipper.dashboard"
                                )}
                            </p>

                        </div>


                        <button
                            type="button"
                            onClick={
                                handleLogout
                            }
                            className="tayeb-button tayeb-button-secondary"
                        >
                            {t(
                                "common.logout"
                            )}
                        </button>

                    </div>


                    {/* =================================================
                        SUMMARY
                    ================================================= */}

                    <div
                        className="tayeb-dashboard-grid"
                        style={{
                            marginBottom:
                                "22px",
                        }}
                    >

                        <StatCard
                            value={
                                shipments.length
                            }
                            label={
                                t(
                                    "shipper.myShipments"
                                )
                            }
                            icon="📦"
                        />

                        <StatCard
                            value={
                                activeShipments.length
                            }
                            label={
                                t(
                                    "shipper.activeShipments"
                                )
                            }
                            icon="🚚"
                        />

                        <StatCard
                            value={
                                completedShipments.length
                            }
                            label={
                                t(
                                    "shipper.completedShipments"
                                )
                            }
                            icon="✓"
                        />

                        <StatCard
                            value={
                                bids.filter(
                                    (bid) =>
                                        bid.status ===
                                        "PENDING"
                                ).length
                            }
                            label={
                                t(
                                    "shipper.driverOffers"
                                )
                            }
                            icon="💰"
                        />

                    </div>


                    {/* =================================================
                        SEND CARGO BUTTON
                    ================================================= */}

                    <div
                        style={{
                            marginBottom:
                                "22px",
                        }}
                    >

                        <button
                            type="button"
                            onClick={() =>
                                setShowPostForm(
                                    (current) =>
                                        !current
                                )
                            }
                            className="tayeb-button tayeb-button-primary"
                            style={{
                                minHeight:
                                    "54px",
                                padding:
                                    "0 24px",
                            }}
                        >
                            📦{" "}
                            {t(
                                "shipper.sendCargo"
                            )}
                            <span>
                                {showPostForm
                                    ? "−"
                                    : "+"}
                            </span>
                        </button>

                    </div>


                    {/* =================================================
                        POST CARGO FORM
                    ================================================= */}

                    {showPostForm && (
                        <section
                            className="tayeb-card tayeb-fade-in"
                            style={{
                                padding:
                                    "25px",
                                marginBottom:
                                    "28px",
                            }}
                        >

                            <div
                                style={{
                                    marginBottom:
                                        "22px",
                                }}
                            >

                                <span className="tayeb-section-label">
                                    {t(
                                        "shipper.postCargo"
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
                                    }}
                                >
                                    {t(
                                        "shipper.cargoDetails"
                                    )}
                                </h2>

                            </div>


                            <form
                                onSubmit={
                                    handlePostCargo
                                }
                            >

                                <div
                                    className="tayeb-dashboard-grid"
                                >

                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "shipper.whatAreYouSending"
                                                )}
                                            </label>

                                            <select
                                                value={cargo.itemType}
                                                onChange={(event) =>
                                                    updateCargo(
                                                        "itemType",
                                                        event.target.value
                                                    )
                                                }
                                                className="tayeb-input"
                                                disabled={posting}
                                            >
                                                <option value="Bags/Sacks">
                                                    Bags / Sacks
                                                </option>

                                                <option value="Crates/Boxes">
                                                    Crates / Boxes
                                                </option>

                                                <option value="Drums/Oil">
                                                    Drums / Oil
                                                </option>

                                                <option value="Furniture/Bulky">
                                                    Furniture / Bulky
                                                </option>
                                            </select>

                                        </div>

                                    </div>


                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "common.quantity"
                                                )}
                                            </label>

                                            <input
                                                type="number"
                                                min="1"
                                                value={
                                                    cargo.quantity
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCargo(
                                                        "quantity",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: 3"
                                                disabled={
                                                    posting
                                                }
                                            />

                                        </div>

                                    </div>


                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "shipper.pickupLocation"
                                                )}
                                            </label>

                                            <input
                                                value={
                                                    cargo.origin
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCargo(
                                                        "origin",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: Akwa"
                                                disabled={
                                                    posting
                                                }
                                            />

                                        </div>

                                    </div>


                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "shipper.deliveryLocation"
                                                )}
                                            </label>

                                            <input
                                                value={
                                                    cargo.destination
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCargo(
                                                        "destination",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: Mvan"
                                                disabled={
                                                    posting
                                                }
                                            />

                                        </div>

                                    </div>


                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "shipper.yourPrice"
                                                )}
                                            </label>

                                            <input
                                                inputMode="numeric"
                                                value={
                                                    cargo.price
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCargo(
                                                        "price",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Example: 25000"
                                                disabled={
                                                    posting
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
                                                    "shipper.priceHint"
                                                )}
                                            </small>

                                        </div>

                                    </div>


                                    <div className="tayeb-span-6">

                                        <div className="tayeb-form-group">

                                            <label className="tayeb-label">
                                                {t(
                                                    "common.phone"
                                                )}{" "}
                                                <span
                                                    style={{
                                                        color:
                                                            "#9ca3af",
                                                    }}
                                                >
                                                    (
                                                    {t(
                                                        "driver.optional"
                                                    )}
                                                    )
                                                </span>
                                            </label>

                                            <input
                                                type="tel"
                                                value={
                                                    cargo.receiverPhone
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCargo(
                                                        "receiverPhone",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="tayeb-input"
                                                placeholder="Receiver phone"
                                                disabled={
                                                    posting
                                                }
                                            />

                                        </div>

                                    </div>

                                </div>


                                <button
                                    type="submit"
                                    disabled={
                                        posting
                                    }
                                    className="tayeb-button tayeb-button-primary tayeb-button-full"
                                    style={{
                                        marginTop:
                                            "5px",
                                    }}
                                >

                                    {posting ? (
                                        <>
                                            <span className="tayeb-spinner" />

                                            {t(
                                                "common.loading"
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {t(
                                                "shipper.sendCargo"
                                            )}
                                            →
                                        </>
                                    )}

                                </button>

                            </form>

                        </section>
                    )}


                    {/* =================================================
                        ACTIVE SHIPMENTS
                    ================================================= */}

                    <section>

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
                                        "shipper.activeShipments"
                                    )}
                                </h2>

                            </div>

                        </div>


                        {activeShipments.length ===
                            0 ? (
                            <div className="tayeb-empty">

                                <div className="tayeb-empty-icon">
                                    📦
                                </div>

                                <h3>
                                    {t(
                                        "shipper.noOffers"
                                    )}
                                </h3>

                                <p>
                                    {t(
                                        "shipper.waitingForOffers"
                                    )}
                                </p>

                            </div>
                        ) : (
                            <div
                                style={{
                                    display:
                                        "grid",
                                    gap:
                                        "18px",
                                }}
                            >

                                {activeShipments.map(
                                    (
                                        shipment
                                    ) => (
                                        <ShipmentSection
                                            key={
                                                shipment.id
                                            }
                                            shipment={
                                                shipment
                                            }
                                            bids={shipmentBids(
                                                shipment.id
                                            )}
                                            statusText={
                                                statusText
                                            }
                                            statusClass={
                                                statusClass
                                            }
                                            formatPrice={
                                                formatPrice
                                            }
                                            selectedBid={
                                                selectedBid
                                            }
                                            setSelectedBid={
                                                setSelectedBid
                                            }
                                            counterPrice={
                                                counterPrice
                                            }
                                            setCounterPrice={
                                                setCounterPrice
                                            }
                                            counterLoading={
                                                counterLoading
                                            }
                                            suggestAnotherPrice={
                                                suggestAnotherPrice
                                            }
                                            acceptBid={
                                                acceptBid
                                            }
                                            updateShipmentStatus={
                                                updateShipmentStatus
                                            }
                                            t={
                                                t
                                            }
                                        />
                                    )
                                )}

                            </div>
                        )}

                    </section>


                    {/* =================================================
                        HISTORY
                    ================================================= */}

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
                                "shipper.shipmentHistory"
                            )}
                        </h2>


                        {completedShipments.length ===
                            0 ? (
                            <div
                                style={{
                                    padding:
                                        "20px",
                                    border:
                                        "1px solid #e5e7eb",
                                    borderRadius:
                                        "20px",
                                    background:
                                        "white",
                                    color:
                                        "#9ca3af",
                                    fontSize:
                                        "12px",
                                }}
                            >
                                {t(
                                    "common.noResults"
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display:
                                        "grid",
                                    gap:
                                        "14px",
                                }}
                            >

                                {completedShipments.map(
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
                                                    alignItems:
                                                        "flex-start",
                                                }}
                                            >

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
                                                        {
                                                            shipment.item_type
                                                        }
                                                    </strong>

                                                    <p
                                                        style={{
                                                            marginTop:
                                                                "5px",
                                                            color:
                                                                "#6b7280",
                                                            fontSize:
                                                                "11px",
                                                        }}
                                                    >
                                                        {
                                                            shipment.origin
                                                        }{" "}
                                                        →
                                                        {" "}
                                                        {
                                                            shipment.destination
                                                        }
                                                    </p>

                                                </div>

                                                <span className="tayeb-badge tayeb-badge-success">
                                                    {t(
                                                        "status.completed"
                                                    )}
                                                </span>

                                            </div>

                                        </div>
                                    )
                                )}

                            </div>
                        )}

                    </section>

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


                <DeleteAccount user={user} />

            </main>
        </>
    );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
    value,
    label,
    icon,
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
   SHIPMENT SECTION
========================================================= */

function ShipmentSection({
    shipment,
    bids,
    statusText,
    statusClass,
    formatPrice,
    selectedBid,
    setSelectedBid,
    counterPrice,
    setCounterPrice,
    counterLoading,
    suggestAnotherPrice,
    acceptBid,
    updateShipmentStatus,
    t,
}) {
    const matched =
        shipment.driver;

    return (
        <article className="tayeb-shipment-card">

            {/* =====================================================
                SHIPMENT HEADER
            ===================================================== */}

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
                            textTransform:
                                "uppercase",
                            marginBottom:
                                "5px",
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
                                "17px",
                            fontWeight:
                                900,
                        }}
                    >
                        {
                            shipment.item_type
                        }
                    </h3>

                </div>

                <span
                    className={statusClass(
                        shipment.status
                    )}
                >
                    {statusText(
                        shipment.status
                    )}
                </span>

            </div>


            {/* =====================================================
                ROUTE
            ===================================================== */}

            <div
                className="tayeb-route"
                style={{
                    marginTop:
                        "22px",
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


            {/* =====================================================
                BASIC DETAILS
            ===================================================== */}

            <div
                style={{
                    display:
                        "flex",
                    flexWrap:
                        "wrap",
                    gap:
                        "8px",
                    marginTop:
                        "17px",
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
                        shipment.agreed_price ??
                        shipment.initial_offer
                    )}{" "}
                    FCFA
                </span>

            </div>


            {/* =====================================================
                MATCHED DRIVER
            ===================================================== */}

            {matched && (
                <div
                    style={{
                        marginTop:
                            "20px",
                        padding:
                            "18px",
                        background:
                            "#fff7ed",
                        border:
                            "1px solid #fed7aa",
                        borderRadius:
                            "20px",
                    }}
                >

                    <div
                        style={{
                            display:
                                "flex",
                            alignItems:
                                "center",
                            gap:
                                "12px",
                        }}
                    >

                        <div className="tayeb-avatar">
                            {matched.full_name
                                ?.charAt(
                                    0
                                )
                                ?.toUpperCase() ||
                                "D"}
                        </div>

                        <div
                            style={{
                                flex:
                                    1,
                                minWidth:
                                    0,
                            }}
                        >

                            <strong
                                style={{
                                    display:
                                        "block",
                                    color:
                                        "#111827",
                                    fontSize:
                                        "13px",
                                }}
                            >
                                {
                                    matched.full_name
                                }
                            </strong>

                            <span
                                style={{
                                    display:
                                        "block",
                                    marginTop:
                                        "3px",
                                    color:
                                        "#6b7280",
                                    fontSize:
                                        "10px",
                                }}
                            >
                                {matched.rating
                                    ? `★ ${matched.rating}`
                                    : "★ —"}
                                {" · "}
                                {
                                    matched.vehicle_type ||
                                    t(
                                        "common.vehicle"
                                    )
                                }
                            </span>

                        </div>

                        <span className="tayeb-badge tayeb-badge-success">
                            {t(
                                "common.verified"
                            )}
                        </span>

                    </div>


                    <div
                        style={{
                            display:
                                "grid",
                            gridTemplateColumns:
                                "repeat(2, 1fr)",
                            gap:
                                "8px",
                            marginTop:
                                "15px",
                        }}
                    >

                        <InfoBox
                            label={
                                t(
                                    "common.phone"
                                )
                            }
                            value={
                                matched.phone_number ||
                                shipment.driver_phone ||
                                "—"
                            }
                        />

                        <InfoBox
                            label={
                                t(
                                    "common.completed"
                                )
                            }
                            value={
                                matched.total_completed_shipments ??
                                "0"
                            }
                        />

                    </div>

                </div>
            )}


            {/* =====================================================
                DELIVERY STATUS BUTTONS
            ===================================================== */}

            {shipment.status ===
                "MATCHED" && (
                    <div
                        style={{
                            display:
                                "flex",
                            gap:
                                "8px",
                            marginTop:
                                "15px",
                        }}
                    >

                        <button
                            type="button"
                            onClick={() =>
                                updateShipmentStatus(
                                    shipment,
                                    "DEPARTED"
                                )
                            }
                            className="tayeb-button tayeb-button-primary"
                            style={{
                                flex:
                                    1,
                            }}
                        >
                            🚚{" "}
                            {t(
                                "driver.startDelivery"
                            )}
                        </button>

                    </div>
                )}

            {shipment.status ===
                "DEPARTED" && (
                    <div
                        style={{
                            marginTop:
                                "15px",
                            padding:
                                "13px",
                            borderRadius:
                                "14px",
                            background:
                                "#fff7ed",
                            color:
                                "#c2410c",
                            fontSize:
                                "11px",
                            fontWeight:
                                800,
                        }}
                    >
                        🚚{" "}
                        {t(
                            "status.departed"
                        )}
                    </div>
                )}

            {shipment.status ===
                "ARRIVED" && (
                    <div
                        style={{
                            marginTop:
                                "15px",
                            padding:
                                "13px",
                            borderRadius:
                                "14px",
                            background:
                                "#f0fdf4",
                            color:
                                "#166534",
                            fontSize:
                                "11px",
                            fontWeight:
                                800,
                        }}
                    >
                        ✓{" "}
                        {t(
                            "status.arrived"
                        )}
                    </div>
                )}


            {/* =====================================================
                DRIVER OFFERS
            ===================================================== */}

            {!matched &&
                shipment.status ===
                "OPEN" && (
                    <div
                        style={{
                            marginTop:
                                "24px",
                        }}
                    >

                        <div
                            style={{
                                display:
                                    "flex",
                                justifyContent:
                                    "space-between",
                                alignItems:
                                    "center",
                                gap:
                                    "10px",
                                marginBottom:
                                    "12px",
                            }}
                        >

                            <h4
                                style={{
                                    color:
                                        "#111827",
                                    fontSize:
                                        "15px",
                                    fontWeight:
                                        900,
                                }}
                            >
                                {t(
                                    "shipper.driverOffers"
                                )}
                            </h4>

                            <span className="tayeb-badge tayeb-badge-orange">
                                {
                                    bids.length
                                }
                            </span>

                        </div>


                        {bids.length ===
                            0 ? (
                            <div
                                style={{
                                    padding:
                                        "18px",
                                    border:
                                        "1px dashed #d1d5db",
                                    borderRadius:
                                        "17px",
                                    background:
                                        "#fafafa",
                                    color:
                                        "#9ca3af",
                                    fontSize:
                                        "11px",
                                    textAlign:
                                        "center",
                                }}
                            >
                                {t(
                                    "shipper.waitingForOffers"
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    display:
                                        "grid",
                                    gap:
                                        "12px",
                                }}
                            >

                                {bids
                                    .filter(
                                        (
                                            bid
                                        ) =>
                                            bid.status !==
                                            "REJECTED"
                                    )
                                    .map(
                                        (
                                            bid
                                        ) => (
                                            <BidCard
                                                key={
                                                    bid.id
                                                }
                                                bid={
                                                    bid
                                                }
                                                formatPrice={
                                                    formatPrice
                                                }
                                                selectedBid={
                                                    selectedBid
                                                }
                                                setSelectedBid={
                                                    setSelectedBid
                                                }
                                                counterPrice={
                                                    counterPrice
                                                }
                                                setCounterPrice={
                                                    setCounterPrice
                                                }
                                                counterLoading={
                                                    counterLoading
                                                }
                                                suggestAnotherPrice={
                                                    suggestAnotherPrice
                                                }
                                                acceptBid={
                                                    acceptBid
                                                }
                                                t={
                                                    t
                                                }
                                            />
                                        )
                                    )}

                            </div>
                        )}

                    </div>
                )}

        </article>
    );
}


/* =========================================================
   BID CARD
========================================================= */

function BidCard({
    bid,
    formatPrice,
    selectedBid,
    setSelectedBid,
    counterPrice,
    setCounterPrice,
    counterLoading,
    suggestAnotherPrice,
    acceptBid,
    t,
}) {
    const driver =
        bid.driver;

    const price =
        bid.counter_price ??
        bid.proposed_price;

    const isSelected =
        selectedBid?.id ===
        bid.id;


    return (
        <div
            className="tayeb-offer-card"
            style={{
                borderColor:
                    isSelected
                        ? "#fed7aa"
                        : "#e5e7eb",
                background:
                    isSelected
                        ? "#fffaf5"
                        : "white",
            }}
        >

            <div className="tayeb-offer-header">

                <div className="tayeb-offer-user">

                    <div className="tayeb-avatar">
                        {driver?.full_name
                            ?.charAt(
                                0
                            )
                            ?.toUpperCase() ||
                            "D"}
                    </div>

                    <div className="tayeb-offer-user-info">

                        <div className="tayeb-offer-user-name">
                            {
                                driver?.full_name ||
                                t(
                                    "common.driver"
                                )
                            }
                        </div>

                        <div className="tayeb-offer-user-meta">
                            {driver?.rating
                                ? `★ ${driver.rating}`
                                : "★ —"}
                            {" · "}
                            {
                                driver?.vehicle_type ||
                                t(
                                    "common.vehicle"
                                )
                            }
                        </div>

                    </div>

                </div>


                <div className="tayeb-price">

                    {formatPrice(
                        price
                    )}

                    <small>
                        FCFA
                    </small>

                </div>

            </div>


            {/* DETAILS */}

            <div
                style={{
                    display:
                        "grid",
                    gridTemplateColumns:
                        "repeat(2, 1fr)",
                    gap:
                        "8px",
                    marginTop:
                        "15px",
                }}
            >

                <InfoBox
                    label={
                        t(
                            "driver.arrivalTime"
                        )
                    }
                    value={
                        bid.eta ||
                        "—"
                    }
                />

                <InfoBox
                    label={
                        t(
                            "common.completed"
                        )
                    }
                    value={
                        driver?.total_completed_shipments ??
                        "0"
                    }
                />

            </div>


            {bid.note && (
                <div
                    style={{
                        marginTop:
                            "10px",
                        padding:
                            "11px",
                        borderRadius:
                            "12px",
                        background:
                            "#f9fafb",
                        color:
                            "#6b7280",
                        fontSize:
                            "10px",
                    }}
                >
                    {bid.note}
                </div>
            )}


            {/* ACTIONS */}

            {bid.status ===
                "COUNTERED" &&
                bid.last_offer_by ===
                "SHIPPER" && (
                    <div
                        style={{
                            marginTop:
                                "12px",
                            padding:
                                "10px",
                            borderRadius:
                                "12px",
                            background:
                                "#fff7ed",
                            color:
                                "#c2410c",
                            fontSize:
                                "10px",
                            fontWeight:
                                800,
                        }}
                    >
                        {t(
                            "status.countered"
                        )}
                    </div>
                )}


            <div
                style={{
                    display:
                        "grid",
                    gridTemplateColumns:
                        "1fr 1fr",
                    gap:
                        "8px",
                    marginTop:
                        "15px",
                }}
            >

                <button
                    type="button"
                    onClick={() =>
                        acceptBid(
                            bid
                        )
                    }
                    className="tayeb-button tayeb-button-success"
                    disabled={
                        bid.status ===
                        "COUNTERED"
                        &&
                        bid.last_offer_by ===
                        "SHIPPER"
                    }
                >
                    ✓{" "}
                    {t(
                        "shipper.acceptOffer"
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedBid(
                            isSelected
                                ? null
                                : bid
                        );

                        setCounterPrice(
                            ""
                        );
                    }}
                    className="tayeb-button tayeb-button-light"
                >
                    {t(
                        "shipper.suggestPrice"
                    )}
                </button>

            </div>


            {/* COUNTER PRICE */}

            {isSelected && (
                <div
                    className="tayeb-fade-in"
                    style={{
                        marginTop:
                            "12px",
                        padding:
                            "15px",
                        borderRadius:
                            "17px",
                        background:
                            "#fff7ed",
                        border:
                            "1px solid #fed7aa",
                    }}
                >

                    <label className="tayeb-label">
                        {t(
                            "shipper.suggestedPrice"
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
                                event
                                    .target
                                    .value
                                    .replace(
                                        /[^\d]/g,
                                        ""
                                    )
                            )
                        }
                        className="tayeb-input"
                        style={{
                            marginTop:
                                "8px",
                        }}
                        placeholder="Example: 20000"
                        disabled={
                            counterLoading
                        }
                    />

                    <button
                        type="button"
                        onClick={() =>
                            suggestAnotherPrice(
                                bid
                            )
                        }
                        disabled={
                            counterLoading
                        }
                        className="tayeb-button tayeb-button-primary tayeb-button-full"
                        style={{
                            marginTop:
                                "9px",
                        }}
                    >

                        {counterLoading ? (
                            <>
                                <span className="tayeb-spinner" />
                                {t(
                                    "common.loading"
                                )}
                            </>
                        ) : (
                            t(
                                "shipper.sendPrice"
                            )
                        )}

                    </button>

                </div>
            )}

        </div>
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
                    "#f9fafb",
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
                    textTransform:
                        "uppercase",
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
                }}
            >
                {value}
            </strong>

        </div>
    );
}