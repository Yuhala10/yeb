import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import supabase from "../lib/supabaseClient";
import BrandLogo from "../components/BrandLogo";
import { useLanguage } from "../lib/LanguageContext";

const ADMIN_PHONE = "681731512";

export default function AdminDashboard() {
    const router = useRouter();

    const {
        language,
        changeLanguage,
    } = useLanguage();

    const isFrench =
        language === "fr";

    const [admin, setAdmin] =
        useState(null);

    const [users, setUsers] =
        useState([]);

    const [shipments, setShipments] =
        useState([]);

    const [bids, setBids] =
        useState([]);

    const [notifications, setNotifications] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [activeSection, setActiveSection] =
        useState("overview");

    const [search, setSearch] =
        useState("");

    const [errorMessage, setErrorMessage] =
        useState("");


    /* =========================================================
       TEXT
    ========================================================= */

    const text = {
        admin: isFrench
            ? "Administrateur"
            : "Administrator",

        dashboard: isFrench
            ? "Tableau de bord"
            : "Dashboard",

        overview: isFrench
            ? "Vue générale"
            : "Overview",

        users: isFrench
            ? "Utilisateurs"
            : "Users",

        drivers: isFrench
            ? "Chauffeurs"
            : "Drivers",

        shippers: isFrench
            ? "Expéditeurs"
            : "Shippers",

        shipments: isFrench
            ? "Colis"
            : "Shipments",

        offers: isFrench
            ? "Offres"
            : "Offers",

        matches: isFrench
            ? "Correspondances"
            : "Matches",

        notifications: isFrench
            ? "Notifications"
            : "Notifications",

        welcome: isFrench
            ? "Bienvenue"
            : "Welcome",

        platformOverview: isFrench
            ? "Voici ce qui se passe sur Tayeb."
            : "Here's what's happening across Tayeb.",

        totalUsers: isFrench
            ? "Tous les utilisateurs"
            : "Total users",

        totalDrivers: isFrench
            ? "Chauffeurs"
            : "Drivers",

        totalShippers: isFrench
            ? "Expéditeurs"
            : "Shippers",

        totalShipments: isFrench
            ? "Tous les colis"
            : "Total shipments",

        openShipments: isFrench
            ? "Colis disponibles"
            : "Open shipments",

        activeShipments: isFrench
            ? "Livraisons en cours"
            : "Active deliveries",

        completed: isFrench
            ? "Livrés"
            : "Completed",

        totalOffers: isFrench
            ? "Offres reçues"
            : "Total offers",

        matched: isFrench
            ? "Correspondances réussies"
            : "Successful matches",

        availableDrivers: isFrench
            ? "Chauffeurs disponibles"
            : "Available drivers",

        unreadNotifications: isFrench
            ? "Non lues"
            : "Unread",

        recentShipments: isFrench
            ? "Colis récents"
            : "Recent shipments",

        recentUsers: isFrench
            ? "Nouveaux utilisateurs"
            : "Recent users",

        recentOffers: isFrench
            ? "Offres récentes"
            : "Recent offers",

        allUsers: isFrench
            ? "Tous les utilisateurs"
            : "All users",

        allShipments: isFrench
            ? "Tous les colis"
            : "All shipments",

        allOffers: isFrench
            ? "Toutes les offres"
            : "All offers",

        noData: isFrench
            ? "Aucune donnée."
            : "No data available.",

        loading: isFrench
            ? "Chargement..."
            : "Loading...",

        refresh: isFrench
            ? "Actualiser"
            : "Refresh",

        logout: isFrench
            ? "Se déconnecter"
            : "Log out",

        search: isFrench
            ? "Rechercher..."
            : "Search...",

        name: isFrench
            ? "Nom"
            : "Name",

        phone: isFrench
            ? "Téléphone"
            : "Phone",

        role: isFrench
            ? "Rôle"
            : "Role",

        vehicle: isFrench
            ? "Véhicule"
            : "Vehicle",

        availability: isFrench
            ? "Disponibilité"
            : "Availability",

        available: isFrench
            ? "Disponible"
            : "Available",

        busy: isFrench
            ? "Occupé"
            : "Busy",

        from: isFrench
            ? "Départ"
            : "From",

        to: isFrench
            ? "Destination"
            : "To",

        price: isFrench
            ? "Prix"
            : "Price",

        driver: isFrench
            ? "Chauffeur"
            : "Driver",

        shipper: isFrench
            ? "Expéditeur"
            : "Shipper",

        status: isFrench
            ? "Statut"
            : "Status",

        date: isFrench
            ? "Date"
            : "Date",

        noUsers: isFrench
            ? "Aucun utilisateur trouvé."
            : "No users found.",

        noShipments: isFrench
            ? "Aucun colis trouvé."
            : "No shipments found.",

        noOffers: isFrench
            ? "Aucune offre trouvée."
            : "No offers found.",

        accessDenied: isFrench
            ? "Accès refusé."
            : "Access denied.",

        loadError: isFrench
            ? "Impossible de charger les données."
            : "Could not load the data.",

        platformFree: isFrench
            ? "Tayeb est gratuit pour le moment."
            : "Tayeb is free for now.",
    };


    /* =========================================================
       ADMIN ACCESS
    ========================================================= */

    useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const savedUser =
            localStorage.getItem(
                "tayebUser"
            );

        if (!savedUser) {
            router.replace(
                "/login"
            );

            return;
        }

        try {
            const parsedUser =
                JSON.parse(
                    savedUser
                );

            if (
                parsedUser?.role !==
                "ADMIN" ||
                parsedUser?.phone_number !==
                ADMIN_PHONE
            ) {
                setErrorMessage(
                    text.accessDenied
                );

                setTimeout(() => {
                    router.replace(
                        "/"
                    );
                }, 900);

                return;
            }

            setAdmin(
                parsedUser
            );

            loadDashboard();

        } catch (error) {
            console.error(
                "Admin session error:",
                error
            );

            router.replace(
                "/login"
            );
        }
    }, [router, language]);


    /* =========================================================
       LOAD DASHBOARD
    ========================================================= */

    async function loadDashboard() {
        setLoading(true);
        setErrorMessage("");

        try {
            const [
                usersResult,
                shipmentsResult,
                bidsResult,
                notificationsResult,
            ] = await Promise.all([
                supabase
                    .from("users")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    ),

                supabase
                    .from("shipments")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    ),

                supabase
                    .from("bids")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    ),

                supabase
                    .from("notifications")
                    .select("*")
                    .order(
                        "created_at",
                        {
                            ascending:
                                false,
                        }
                    ),
            ]);


            if (
                usersResult.error
            ) {
                throw usersResult.error;
            }

            if (
                shipmentsResult.error
            ) {
                throw shipmentsResult.error;
            }

            if (
                bidsResult.error
            ) {
                throw bidsResult.error;
            }

            if (
                notificationsResult.error
            ) {
                throw notificationsResult.error;
            }


            setUsers(
                usersResult.data ||
                []
            );

            setShipments(
                shipmentsResult.data ||
                []
            );

            setBids(
                bidsResult.data ||
                []
            );

            setNotifications(
                notificationsResult.data ||
                []
            );

        } catch (error) {
            console.error(
                "Admin dashboard error:",
                error
            );

            setErrorMessage(
                error?.message ||
                text.loadError
            );
        } finally {
            setLoading(false);
        }
    }


    /* =========================================================
       REFRESH
    ========================================================= */

    async function refreshDashboard() {
        setRefreshing(true);

        await loadDashboard();

        setRefreshing(false);
    }


    /* =========================================================
       LOGOUT
    ========================================================= */

    function logout() {
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


    /* =========================================================
       USER MAPS
    ========================================================= */

    const userMap =
        useMemo(() => {
            const map = {};

            users.forEach(
                (user) => {
                    map[user.id] =
                        user;
                }
            );

            return map;
        }, [users]);


    /* =========================================================
       STATS
    ========================================================= */

    const stats =
        useMemo(() => {
            const drivers =
                users.filter(
                    (user) =>
                        user.role ===
                        "DRIVER"
                );

            const shippers =
                users.filter(
                    (user) =>
                        user.role ===
                        "SHIPPER"
                );

            const open =
                shipments.filter(
                    (shipment) =>
                        shipment.status ===
                        "OPEN"
                );

            const active =
                shipments.filter(
                    (shipment) =>
                        [
                            "MATCHED",
                            "DEPARTED",
                            "ARRIVED",
                        ].includes(
                            shipment.status
                        )
                );

            const completed =
                shipments.filter(
                    (shipment) =>
                        shipment.status ===
                        "COMPLETED"
                );

            const matched =
                shipments.filter(
                    (shipment) =>
                        [
                            "MATCHED",
                            "DEPARTED",
                            "ARRIVED",
                            "COMPLETED",
                        ].includes(
                            shipment.status
                        )
                );

            const availableDrivers =
                drivers.filter(
                    (driver) =>
                        driver.is_available ===
                        true
                );

            const unread =
                notifications.filter(
                    (notification) =>
                        !notification.read
                );

            return {
                users:
                    users.length,

                drivers:
                    drivers.length,

                shippers:
                    shippers.length,

                shipments:
                    shipments.length,

                open:
                    open.length,

                active:
                    active.length,

                completed:
                    completed.length,

                matched:
                    matched.length,

                offers:
                    bids.length,

                availableDrivers:
                    availableDrivers.length,

                unread:
                    unread.length,
            };
        }, [
            users,
            shipments,
            bids,
            notifications,
        ]);


    /* =========================================================
       SEARCH
    ========================================================= */

    const normalizedSearch =
        search
            .trim()
            .toLowerCase();


    const filteredUsers =
        useMemo(() => {
            if (
                !normalizedSearch
            ) {
                return users;
            }

            return users.filter(
                (user) =>
                    String(
                        user.full_name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    String(
                        user.phone_number ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    String(
                        user.role ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        )
            );
        }, [
            users,
            normalizedSearch,
        ]);


    const filteredShipments =
        useMemo(() => {
            if (
                !normalizedSearch
            ) {
                return shipments;
            }

            return shipments.filter(
                (shipment) =>
                    String(
                        shipment.item_type ||
                        shipment.itemType ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    String(
                        shipment.origin ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    String(
                        shipment.destination ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    String(
                        shipment.status ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalizedSearch
                        )
            );
        }, [
            shipments,
            normalizedSearch,
        ]);


    const filteredBids =
        useMemo(() => {
            if (
                !normalizedSearch
            ) {
                return bids;
            }

            return bids.filter(
                (bid) => {
                    const driver =
                        userMap[
                        bid.driver_id
                        ];

                    return (
                        String(
                            driver?.full_name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        String(
                            bid.status ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            ) ||
                        String(
                            bid.proposed_price ||
                            ""
                        )
                            .includes(
                                normalizedSearch
                            )
                    );
                }
            );
        }, [
            bids,
            userMap,
            normalizedSearch,
        ]);


    /* =========================================================
       HELPERS
    ========================================================= */

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
            return "—";
        }

        return `${number.toLocaleString(
            "en-US"
        )} FCFA`;
    }


    function formatDate(
        value
    ) {
        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date.toLocaleString(
            isFrench
                ? "fr-FR"
                : "en-US",
            {
                dateStyle:
                    "short",
                timeStyle:
                    "short",
            }
        );
    }


    function statusLabel(
        status
    ) {
        const labels = {
            OPEN: isFrench
                ? "Disponible"
                : "Open",

            PENDING: isFrench
                ? "En attente"
                : "Pending",

            COUNTERED: isFrench
                ? "Nouveau prix"
                : "New price",

            ACCEPTED: isFrench
                ? "Acceptée"
                : "Accepted",

            MATCHED: isFrench
                ? "Correspondance"
                : "Matched",

            DEPARTED: isFrench
                ? "En route"
                : "On the way",

            ARRIVED: isFrench
                ? "Arrivé"
                : "Arrived",

            COMPLETED: isFrench
                ? "Livré"
                : "Completed",

            REJECTED: isFrench
                ? "Refusée"
                : "Rejected",
        };

        return (
            labels[status] ||
            status ||
            "—"
        );
    }


    function roleLabel(
        role
    ) {
        if (
            role ===
            "DRIVER"
        ) {
            return text.driver;
        }

        if (
            role ===
            "SHIPPER"
        ) {
            return text.shipper;
        }

        if (
            role ===
            "ADMIN"
        ) {
            return text.admin;
        }

        return role ||
            "—";
    }


    /* =========================================================
       NAV
    ========================================================= */

    const navItems = [
        {
            id: "overview",
            label: text.overview,
            icon: "📊",
        },

        {
            id: "users",
            label: text.users,
            icon: "👥",
        },

        {
            id: "shipments",
            label: text.shipments,
            icon: "📦",
        },

        {
            id: "offers",
            label: text.offers,
            icon: "💰",
        },

        {
            id: "notifications",
            label: text.notifications,
            icon: "🔔",
        },
    ];


    /* =========================================================
       RENDER
    ========================================================= */

    if (
        errorMessage &&
        !admin
    ) {
        return (
            <div className="tayeb-admin-page">
                <div className="tayeb-admin-access-error">
                    <BrandLogo
                        width={130}
                        height={48}
                    />

                    <div className="tayeb-admin-error-icon">
                        !
                    </div>

                    <h1>
                        {text.accessDenied}
                    </h1>

                    <p>
                        {errorMessage}
                    </p>
                </div>
            </div>
        );
    }


    if (!admin) {
        return (
            <div className="tayeb-admin-loading">
                <BrandLogo
                    width={130}
                    height={48}
                />

                <span className="tayeb-admin-spinner" />

                <p>
                    {text.loading}
                </p>
            </div>
        );
    }


    return (
        <>
            <Head>
                <title>
                    Tayeb —{" "}
                    {text.dashboard}
                </title>

                <meta
                    name="description"
                    content={
                        text.platformOverview
                    }
                />

                <meta
                    name="theme-color"
                    content="#f97316"
                />
            </Head>


            <div className="tayeb-admin-page">

                {/* =================================================
                   TOP BAR
                ================================================= */}

                <header className="tayeb-admin-topbar">

                    <div className="tayeb-admin-brand">
                        <BrandLogo
                            width={115}
                            height={44}
                        />

                        <div className="tayeb-admin-brand-title">
                            <strong>
                                {text.dashboard}
                            </strong>

                            <span>
                                {text.admin}
                            </span>
                        </div>
                    </div>


                    <div className="tayeb-admin-top-actions">

                        {/* LANGUAGE */}

                        <div className="tayeb-admin-language">

                            <button
                                type="button"
                                className={
                                    language ===
                                        "en"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    changeLanguage(
                                        "en"
                                    )
                                }
                            >
                                EN
                            </button>

                            <button
                                type="button"
                                className={
                                    language ===
                                        "fr"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    changeLanguage(
                                        "fr"
                                    )
                                }
                            >
                                FR
                            </button>

                        </div>


                        <button
                            type="button"
                            className="tayeb-admin-refresh"
                            onClick={
                                refreshDashboard
                            }
                            disabled={
                                refreshing
                            }
                        >
                            {refreshing
                                ? "↻"
                                : "⟳"}

                            <span>
                                {
                                    text.refresh
                                }
                            </span>
                        </button>


                        <div className="tayeb-admin-avatar">
                            A
                        </div>

                    </div>

                </header>


                {/* =================================================
                   LAYOUT
                ================================================= */}

                <div className="tayeb-admin-layout">

                    {/* =================================================
                       SIDEBAR
                    ================================================= */}

                    <aside className="tayeb-admin-sidebar">

                        <div className="tayeb-admin-sidebar-title">
                            TAYEB
                        </div>


                        <nav>
                            {navItems.map(
                                (
                                    item
                                ) => (
                                    <button
                                        key={
                                            item.id
                                        }
                                        type="button"
                                        className={
                                            activeSection ===
                                                item.id
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            setActiveSection(
                                                item.id
                                            )
                                        }
                                    >
                                        <span>
                                            {
                                                item.icon
                                            }
                                        </span>

                                        {
                                            item.label
                                        }
                                    </button>
                                )
                            )}
                        </nav>


                        <div className="tayeb-admin-sidebar-bottom">

                            <div className="tayeb-admin-free-card">

                                <span>
                                    ✓
                                </span>

                                <div>
                                    <strong>
                                        TAYEB
                                    </strong>

                                    <small>
                                        {
                                            text.platformFree
                                        }
                                    </small>
                                </div>

                            </div>


                            <button
                                type="button"
                                className="tayeb-admin-logout"
                                onClick={
                                    logout
                                }
                            >
                                ↪{" "}
                                {
                                    text.logout
                                }
                            </button>

                        </div>

                    </aside>


                    {/* =================================================
                       MAIN
                    ================================================= */}

                    <main className="tayeb-admin-main">

                        <div className="tayeb-admin-mobile-nav">

                            {navItems.map(
                                (
                                    item
                                ) => (
                                    <button
                                        key={
                                            item.id
                                        }
                                        type="button"
                                        className={
                                            activeSection ===
                                                item.id
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() =>
                                            setActiveSection(
                                                item.id
                                            )
                                        }
                                    >
                                        {
                                            item.icon
                                        }

                                        <span>
                                            {
                                                item.label
                                            }
                                        </span>
                                    </button>
                                )
                            )}

                        </div>


                        {/* =================================================
                           HEADING
                        ================================================= */}

                        <div className="tayeb-admin-heading">

                            <div>

                                <span>
                                    TAYEB
                                </span>

                                <h1>
                                    {
                                        text.welcome
                                    }
                                    ,{" "}
                                    {
                                        admin.full_name ||
                                        "Admin"
                                    }
                                </h1>

                                <p>
                                    {
                                        text.platformOverview
                                    }
                                </p>

                            </div>

                        </div>


                        {/* ERROR */}

                        {errorMessage && (
                            <div className="tayeb-admin-inline-error">
                                !
                                <span>
                                    {
                                        errorMessage
                                    }
                                </span>
                            </div>
                        )}


                        {/* =================================================
                           OVERVIEW
                        ================================================= */}

                        {activeSection ===
                            "overview" && (
                                <Overview
                                    stats={
                                        stats
                                    }
                                    shipments={
                                        shipments
                                    }
                                    users={
                                        users
                                    }
                                    bids={
                                        bids
                                    }
                                    userMap={
                                        userMap
                                    }
                                    text={
                                        text
                                    }
                                    formatPrice={
                                        formatPrice
                                    }
                                    formatDate={
                                        formatDate
                                    }
                                    statusLabel={
                                        statusLabel
                                    }
                                />
                            )}


                        {/* =================================================
                           USERS
                        ================================================= */}

                        {activeSection ===
                            "users" && (
                                <section>

                                    <SectionHeader
                                        title={
                                            text.allUsers
                                        }
                                        count={
                                            filteredUsers.length
                                        }
                                        search={
                                            search
                                        }
                                        setSearch={
                                            setSearch
                                        }
                                        placeholder={
                                            text.search
                                        }
                                    />


                                    <UsersTable
                                        users={
                                            filteredUsers
                                        }
                                        text={
                                            text
                                        }
                                        formatDate={
                                            formatDate
                                        }
                                    />

                                </section>
                            )}


                        {/* =================================================
                           SHIPMENTS
                        ================================================= */}

                        {activeSection ===
                            "shipments" && (
                                <section>

                                    <SectionHeader
                                        title={
                                            text.allShipments
                                        }
                                        count={
                                            filteredShipments.length
                                        }
                                        search={
                                            search
                                        }
                                        setSearch={
                                            setSearch
                                        }
                                        placeholder={
                                            text.search
                                        }
                                    />


                                    <ShipmentsTable
                                        shipments={
                                            filteredShipments
                                        }
                                        userMap={
                                            userMap
                                        }
                                        text={
                                            text
                                        }
                                        formatPrice={
                                            formatPrice
                                        }
                                        formatDate={
                                            formatDate
                                        }
                                        statusLabel={
                                            statusLabel
                                        }
                                    />

                                </section>
                            )}


                        {/* =================================================
                           OFFERS
                        ================================================= */}

                        {activeSection ===
                            "offers" && (
                                <section>

                                    <SectionHeader
                                        title={
                                            text.allOffers
                                        }
                                        count={
                                            filteredBids.length
                                        }
                                        search={
                                            search
                                        }
                                        setSearch={
                                            setSearch
                                        }
                                        placeholder={
                                            text.search
                                        }
                                    />


                                    <OffersTable
                                        bids={
                                            filteredBids
                                        }
                                        shipments={
                                            shipments
                                        }
                                        userMap={
                                            userMap
                                        }
                                        text={
                                            text
                                        }
                                        formatPrice={
                                            formatPrice
                                        }
                                        formatDate={
                                            formatDate
                                        }
                                        statusLabel={
                                            statusLabel
                                        }
                                    />

                                </section>
                            )}


                        {/* =================================================
                           NOTIFICATIONS
                        ================================================= */}

                        {activeSection ===
                            "notifications" && (
                                <section>

                                    <div className="tayeb-admin-section-head">

                                        <div>
                                            <span>
                                                TAYEB
                                            </span>

                                            <h2>
                                                {
                                                    text.notifications
                                                }
                                            </h2>
                                        </div>

                                        <div className="tayeb-admin-count">
                                            {
                                                notifications.length
                                            }
                                        </div>

                                    </div>


                                    {notifications.length ===
                                        0 ? (
                                        <EmptyState
                                            text={
                                                text.noData
                                            }
                                        />
                                    ) : (
                                        <div className="tayeb-admin-notifications">

                                            {notifications
                                                .slice(
                                                    0,
                                                    100
                                                )
                                                .map(
                                                    (
                                                        notification
                                                    ) => {
                                                        const owner =
                                                            userMap[
                                                            notification.user_id
                                                            ];

                                                        return (
                                                            <div
                                                                key={
                                                                    notification.id
                                                                }
                                                                className={
                                                                    notification.read
                                                                        ? "tayeb-admin-notification"
                                                                        : "tayeb-admin-notification unread"
                                                                }
                                                            >

                                                                <div className="tayeb-admin-notification-icon">
                                                                    🔔
                                                                </div>

                                                                <div className="tayeb-admin-notification-content">

                                                                    <strong>
                                                                        {
                                                                            notification.title
                                                                        }
                                                                    </strong>

                                                                    <p>
                                                                        {
                                                                            notification.message
                                                                        }
                                                                    </p>

                                                                    <small>
                                                                        {
                                                                            owner?.full_name ||
                                                                            owner?.phone_number ||
                                                                            "—"
                                                                        }
                                                                        {" · "}
                                                                        {
                                                                            formatDate(
                                                                                notification.created_at
                                                                            )
                                                                        }
                                                                    </small>

                                                                </div>

                                                            </div>
                                                        );
                                                    }
                                                )}

                                        </div>
                                    )}

                                </section>
                            )}

                    </main>

                </div>

            </div>
        </>
    );
}


/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
    stats,
    shipments,
    users,
    bids,
    userMap,
    text,
    formatPrice,
    formatDate,
    statusLabel,
}) {
    return (
        <div>

            <div className="tayeb-admin-stat-grid">

                <AdminStat
                    icon="👥"
                    value={
                        stats.users
                    }
                    label={
                        text.totalUsers
                    }
                />

                <AdminStat
                    icon="🚚"
                    value={
                        stats.drivers
                    }
                    label={
                        text.totalDrivers
                    }
                />

                <AdminStat
                    icon="📦"
                    value={
                        stats.shippers
                    }
                    label={
                        text.totalShippers
                    }
                />

                <AdminStat
                    icon="📋"
                    value={
                        stats.shipments
                    }
                    label={
                        text.totalShipments
                    }
                />

                <AdminStat
                    icon="🟠"
                    value={
                        stats.open
                    }
                    label={
                        text.openShipments
                    }
                />

                <AdminStat
                    icon="🚚"
                    value={
                        stats.active
                    }
                    label={
                        text.activeShipments
                    }
                />

                <AdminStat
                    icon="✓"
                    value={
                        stats.completed
                    }
                    label={
                        text.completed
                    }
                />

                <AdminStat
                    icon="🤝"
                    value={
                        stats.matched
                    }
                    label={
                        text.matched
                    }
                />

            </div>


            <div className="tayeb-admin-mini-grid">

                <MiniStat
                    icon="💰"
                    value={
                        stats.offers
                    }
                    label={
                        text.totalOffers
                    }
                />

                <MiniStat
                    icon="🟢"
                    value={
                        stats.availableDrivers
                    }
                    label={
                        text.availableDrivers
                    }
                />

                <MiniStat
                    icon="🔔"
                    value={
                        stats.unread
                    }
                    label={
                        text.unreadNotifications
                    }
                />

            </div>


            <div className="tayeb-admin-two-column">

                <div className="tayeb-admin-panel">

                    <div className="tayeb-admin-panel-head">

                        <div>
                            <span>
                                TAYEB
                            </span>

                            <h2>
                                {
                                    text.recentShipments
                                }
                            </h2>
                        </div>

                    </div>


                    {shipments.length ===
                        0 ? (
                        <EmptyState
                            text={
                                text.noShipments
                            }
                        />
                    ) : (
                        <div className="tayeb-admin-list">

                            {shipments
                                .slice(
                                    0,
                                    6
                                )
                                .map(
                                    (
                                        shipment
                                    ) => {
                                        const shipper =
                                            userMap[
                                            shipment.shipper_id
                                            ];

                                        const driver =
                                            userMap[
                                            shipment.driver_id
                                            ];

                                        return (
                                            <div
                                                key={
                                                    shipment.id
                                                }
                                                className="tayeb-admin-list-item"
                                            >

                                                <div className="tayeb-admin-list-icon">
                                                    📦
                                                </div>

                                                <div className="tayeb-admin-list-main">

                                                    <strong>
                                                        {
                                                            shipment.item_type ||
                                                            shipment.itemType ||
                                                            "Cargo"
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            shipment.origin ||
                                                            "—"
                                                        }
                                                        {" → "}
                                                        {
                                                            shipment.destination ||
                                                            "—"
                                                        }
                                                    </span>

                                                    <small>
                                                        {
                                                            shipper?.full_name ||
                                                            "—"
                                                        }

                                                        {driver &&
                                                            ` · ${driver.full_name}`}
                                                    </small>

                                                </div>

                                                <div className="tayeb-admin-list-side">

                                                    <strong>
                                                        {
                                                            formatPrice(
                                                                shipment.agreed_price ??
                                                                shipment.price
                                                            )
                                                        }
                                                    </strong>

                                                    <StatusBadge
                                                        status={
                                                            shipment.status
                                                        }
                                                        label={
                                                            statusLabel(
                                                                shipment.status
                                                            )
                                                        }
                                                    />

                                                </div>

                                            </div>
                                        );
                                    }
                                )}

                        </div>
                    )}

                </div>


                <div className="tayeb-admin-panel">

                    <div className="tayeb-admin-panel-head">

                        <div>
                            <span>
                                TAYEB
                            </span>

                            <h2>
                                {
                                    text.recentUsers
                                }
                            </h2>
                        </div>

                    </div>


                    {users.length ===
                        0 ? (
                        <EmptyState
                            text={
                                text.noUsers
                            }
                        />
                    ) : (
                        <div className="tayeb-admin-list">

                            {users
                                .slice(
                                    0,
                                    6
                                )
                                .map(
                                    (
                                        user
                                    ) => (
                                        <div
                                            key={
                                                user.id
                                            }
                                            className="tayeb-admin-list-item"
                                        >

                                            <div className="tayeb-admin-user-avatar">
                                                {user.full_name
                                                    ?.charAt(
                                                        0
                                                    )
                                                    ?.toUpperCase() ||
                                                    "T"}
                                            </div>

                                            <div className="tayeb-admin-list-main">

                                                <strong>
                                                    {
                                                        user.full_name ||
                                                        "—"
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        user.phone_number ||
                                                        "—"
                                                    }
                                                </span>

                                                <small>
                                                    {
                                                        roleLabelSimple(
                                                            user.role,
                                                            text
                                                        )
                                                    }
                                                </small>

                                            </div>

                                            <div className="tayeb-admin-list-side">

                                                {user.role ===
                                                    "DRIVER" && (
                                                        <span
                                                            className={
                                                                user.is_available
                                                                    ? "tayeb-dot-status available"
                                                                    : "tayeb-dot-status"
                                                            }
                                                        >
                                                            ●
                                                        </span>
                                                    )}

                                                <small>
                                                    {
                                                        formatDate(
                                                            user.created_at
                                                        )
                                                    }
                                                </small>

                                            </div>

                                        </div>
                                    )
                                )}

                        </div>
                    )}

                </div>

            </div>


            <div className="tayeb-admin-panel">

                <div className="tayeb-admin-panel-head">

                    <div>
                        <span>
                            TAYEB
                        </span>

                        <h2>
                            {
                                text.recentOffers
                            }
                        </h2>
                    </div>

                </div>


                {bids.length ===
                    0 ? (
                    <EmptyState
                        text={
                            text.noOffers
                        }
                    />
                ) : (
                    <div className="tayeb-admin-list">

                        {bids
                            .slice(
                                0,
                                8
                            )
                            .map(
                                (
                                    bid
                                ) => {
                                    const driver =
                                        userMap[
                                        bid.driver_id
                                        ];

                                    return (
                                        <div
                                            key={
                                                bid.id
                                            }
                                            className="tayeb-admin-list-item"
                                        >

                                            <div className="tayeb-admin-list-icon">
                                                💰
                                            </div>

                                            <div className="tayeb-admin-list-main">

                                                <strong>
                                                    {
                                                        driver?.full_name ||
                                                        "Driver"
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        formatPrice(
                                                            bid.counter_price ??
                                                            bid.proposed_price
                                                        )
                                                    }
                                                </span>

                                                <small>
                                                    {
                                                        formatDate(
                                                            bid.created_at
                                                        )
                                                    }
                                                </small>

                                            </div>

                                            <StatusBadge
                                                status={
                                                    bid.status
                                                }
                                                label={
                                                    statusLabel(
                                                        bid.status
                                                    )
                                                }
                                            />

                                        </div>
                                    );
                                }
                            )}

                    </div>
                )}

            </div>

        </div>
    );
}


/* =========================================================
   STAT CARD
========================================================= */

function AdminStat({
    icon,
    value,
    label,
}) {
    return (
        <div className="tayeb-admin-stat">

            <div className="tayeb-admin-stat-icon">
                {icon}
            </div>

            <div>
                <strong>
                    {value}
                </strong>

                <span>
                    {label}
                </span>
            </div>

        </div>
    );
}


/* =========================================================
   MINI STAT
========================================================= */

function MiniStat({
    icon,
    value,
    label,
}) {
    return (
        <div className="tayeb-admin-mini-stat">

            <span>
                {icon}
            </span>

            <div>
                <strong>
                    {value}
                </strong>

                <small>
                    {label}
                </small>
            </div>

        </div>
    );
}


/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({
    title,
    count,
    search,
    setSearch,
    placeholder,
}) {
    return (
        <div className="tayeb-admin-section-head">

            <div>
                <span>
                    TAYEB
                </span>

                <h2>
                    {title}
                </h2>
            </div>


            <div className="tayeb-admin-section-actions">

                <div className="tayeb-admin-count">
                    {count}
                </div>

                <input
                    value={
                        search
                    }
                    onChange={(
                        event
                    ) =>
                        setSearch(
                            event
                                .target
                                .value
                        )
                    }
                    placeholder={
                        placeholder
                    }
                    className="tayeb-admin-search"
                />

            </div>

        </div>
    );
}


/* =========================================================
   USERS TABLE
========================================================= */

function UsersTable({
    users,
    text,
    formatDate,
}) {
    if (
        users.length ===
        0
    ) {
        return (
            <EmptyState
                text={
                    text.noUsers
                }
            />
        );
    }

    return (
        <div className="tayeb-admin-table-wrap">

            <table className="tayeb-admin-table">

                <thead>
                    <tr>
                        <th>
                            {text.name}
                        </th>

                        <th>
                            {text.phone}
                        </th>

                        <th>
                            {text.role}
                        </th>

                        <th>
                            {text.vehicle}
                        </th>

                        <th>
                            {text.availability}
                        </th>

                        <th>
                            {text.date}
                        </th>
                    </tr>
                </thead>


                <tbody>

                    {users.map(
                        (
                            user
                        ) => (
                            <tr
                                key={
                                    user.id
                                }
                            >

                                <td>
                                    <div className="tayeb-table-user">

                                        <div className="tayeb-admin-user-avatar">
                                            {user.full_name
                                                ?.charAt(
                                                    0
                                                )
                                                ?.toUpperCase() ||
                                                "T"}
                                        </div>

                                        <strong>
                                            {
                                                user.full_name ||
                                                "—"
                                            }
                                        </strong>

                                    </div>
                                </td>

                                <td>
                                    {
                                        user.phone_number ||
                                        "—"
                                    }
                                </td>

                                <td>
                                    <RoleBadge
                                        role={
                                            user.role
                                        }
                                        text={
                                            text
                                        }
                                    />
                                </td>

                                <td>
                                    {
                                        user.vehicle_type ||
                                        "—"
                                    }

                                    {user.plate_number && (
                                        <small className="tayeb-table-sub">
                                            {
                                                user.plate_number
                                            }
                                        </small>
                                    )}
                                </td>

                                <td>
                                    {user.role ===
                                        "DRIVER" ? (
                                        <span
                                            className={
                                                user.is_available
                                                    ? "tayeb-availability available"
                                                    : "tayeb-availability busy"
                                            }
                                        >
                                            ●{" "}
                                            {user.is_available
                                                ? text.available
                                                : text.busy}
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </td>

                                <td>
                                    {
                                        formatDate(
                                            user.created_at
                                        )
                                    }
                                </td>

                            </tr>
                        )
                    )}

                </tbody>

            </table>

        </div>
    );
}


/* =========================================================
   SHIPMENTS TABLE
========================================================= */

function ShipmentsTable({
    shipments,
    userMap,
    text,
    formatPrice,
    formatDate,
    statusLabel,
}) {
    if (
        shipments.length ===
        0
    ) {
        return (
            <EmptyState
                text={
                    text.noShipments
                }
            />
        );
    }

    return (
        <div className="tayeb-admin-table-wrap">

            <table className="tayeb-admin-table">

                <thead>
                    <tr>
                        <th>
                            {text.shipments}
                        </th>

                        <th>
                            {text.shipper}
                        </th>

                        <th>
                            {text.driver}
                        </th>

                        <th>
                            {text.price}
                        </th>

                        <th>
                            {text.status}
                        </th>

                        <th>
                            {text.date}
                        </th>
                    </tr>
                </thead>


                <tbody>

                    {shipments.map(
                        (
                            shipment
                        ) => {
                            const shipper =
                                userMap[
                                shipment.shipper_id
                                ];

                            const driver =
                                userMap[
                                shipment.driver_id
                                ];

                            return (
                                <tr
                                    key={
                                        shipment.id
                                    }
                                >

                                    <td>
                                        <strong>
                                            {
                                                shipment.item_type ||
                                                shipment.itemType ||
                                                "Cargo"
                                            }
                                        </strong>

                                        <small className="tayeb-table-sub">
                                            {
                                                shipment.origin ||
                                                "—"
                                            }
                                            {" → "}
                                            {
                                                shipment.destination ||
                                                "—"
                                            }
                                        </small>
                                    </td>

                                    <td>
                                        {
                                            shipper?.full_name ||
                                            "—"
                                        }
                                    </td>

                                    <td>
                                        {
                                            driver?.full_name ||
                                            shipment.driver_name ||
                                            "—"
                                        }
                                    </td>

                                    <td>
                                        {
                                            formatPrice(
                                                shipment.agreed_price ??
                                                shipment.price
                                            )
                                        }
                                    </td>

                                    <td>
                                        <StatusBadge
                                            status={
                                                shipment.status
                                            }
                                            label={
                                                statusLabel(
                                                    shipment.status
                                                )
                                            }
                                        />
                                    </td>

                                    <td>
                                        {
                                            formatDate(
                                                shipment.created_at
                                            )
                                        }
                                    </td>

                                </tr>
                            );
                        }
                    )}

                </tbody>

            </table>

        </div>
    );
}


/* =========================================================
   OFFERS TABLE
========================================================= */

function OffersTable({
    bids,
    shipments,
    userMap,
    text,
    formatPrice,
    formatDate,
    statusLabel,
}) {
    const shipmentMap =
        {};

    shipments.forEach(
        (
            shipment
        ) => {
            shipmentMap[
                shipment.id
            ] =
                shipment;
        }
    );


    if (
        bids.length ===
        0
    ) {
        return (
            <EmptyState
                text={
                    text.noOffers
                }
            />
        );
    }


    return (
        <div className="tayeb-admin-table-wrap">

            <table className="tayeb-admin-table">

                <thead>
                    <tr>
                        <th>
                            {text.driver}
                        </th>

                        <th>
                            {text.shipments}
                        </th>

                        <th>
                            {text.price}
                        </th>

                        <th>
                            {text.status}
                        </th>

                        <th>
                            {text.date}
                        </th>
                    </tr>
                </thead>


                <tbody>

                    {bids.map(
                        (
                            bid
                        ) => {
                            const driver =
                                userMap[
                                bid.driver_id
                                ];

                            const shipment =
                                shipmentMap[
                                bid.shipment_id
                                ];

                            return (
                                <tr
                                    key={
                                        bid.id
                                    }
                                >

                                    <td>
                                        <div className="tayeb-table-user">

                                            <div className="tayeb-admin-user-avatar">
                                                {driver?.full_name
                                                    ?.charAt(
                                                        0
                                                    )
                                                    ?.toUpperCase() ||
                                                    "D"}
                                            </div>

                                            <div>
                                                <strong>
                                                    {
                                                        driver?.full_name ||
                                                        "Driver"
                                                    }
                                                </strong>

                                                <small className="tayeb-table-sub">
                                                    {
                                                        driver?.phone_number ||
                                                        "—"
                                                    }
                                                </small>
                                            </div>

                                        </div>
                                    </td>

                                    <td>
                                        <strong>
                                            {
                                                shipment?.item_type ||
                                                shipment?.itemType ||
                                                "Cargo"
                                            }
                                        </strong>

                                        <small className="tayeb-table-sub">
                                            {
                                                shipment?.origin ||
                                                "—"
                                            }
                                            {" → "}
                                            {
                                                shipment?.destination ||
                                                "—"
                                            }
                                        </small>
                                    </td>

                                    <td>
                                        {
                                            formatPrice(
                                                bid.counter_price ??
                                                bid.proposed_price
                                            )
                                        }
                                    </td>

                                    <td>
                                        <StatusBadge
                                            status={
                                                bid.status
                                            }
                                            label={
                                                statusLabel(
                                                    bid.status
                                                )
                                            }
                                        />
                                    </td>

                                    <td>
                                        {
                                            formatDate(
                                                bid.created_at
                                            )
                                        }
                                    </td>

                                </tr>
                            );
                        }
                    )}

                </tbody>

            </table>

        </div>
    );
}


/* =========================================================
   BADGES
========================================================= */

function StatusBadge({
    status,
    label,
}) {
    let className =
        "tayeb-status-badge";

    if (
        [
            "MATCHED",
            "ACCEPTED",
            "COMPLETED",
        ].includes(
            status
        )
    ) {
        className +=
            " success";
    } else if (
        [
            "OPEN",
            "PENDING",
            "COUNTERED",
            "DEPARTED",
            "ARRIVED",
        ].includes(
            status
        )
    ) {
        className +=
            " orange";
    } else if (
        status ===
        "REJECTED"
    ) {
        className +=
            " danger";
    }

    return (
        <span
            className={
                className
            }
        >
            {label}
        </span>
    );
}


function RoleBadge({
    role,
    text,
}) {
    let label =
        role;

    if (
        role ===
        "DRIVER"
    ) {
        label =
            text.driver;
    }

    if (
        role ===
        "SHIPPER"
    ) {
        label =
            text.shipper;
    }

    if (
        role ===
        "ADMIN"
    ) {
        label =
            text.admin;
    }

    return (
        <span className="tayeb-role-badge">
            {label}
        </span>
    );
}


function roleLabelSimple(
    role,
    text
) {
    if (
        role ===
        "DRIVER"
    ) {
        return text.driver;
    }

    if (
        role ===
        "SHIPPER"
    ) {
        return text.shipper;
    }

    if (
        role ===
        "ADMIN"
    ) {
        return text.admin;
    }

    return role ||
        "—";
}


/* =========================================================
   EMPTY
========================================================= */

function EmptyState({
    text,
}) {
    return (
        <div className="tayeb-admin-empty">

            <div>
                📭
            </div>

            <p>
                {text}
            </p>

        </div>
    );
}


/* =========================================================
   GLOBAL STYLES
========================================================= */

const adminStyles = `
    .tayeb-admin-page {
        min-height: 100vh;
        background: #f8fafc;
        color: #111827;
    }

    .tayeb-admin-loading,
    .tayeb-admin-access-error {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 30px;
        background: #ffffff;
        text-align: center;
    }

    .tayeb-admin-loading p,
    .tayeb-admin-access-error p {
        margin: 0;
        color: #9ca3af;
        font-size: 10px;
    }

    .tayeb-admin-spinner {
        width: 22px;
        height: 22px;
        border: 3px solid #fed7aa;
        border-top-color: #f97316;
        border-radius: 50%;
        animation: tayebAdminSpin .7s linear infinite;
    }

    @keyframes tayebAdminSpin {
        to {
            transform: rotate(360deg);
        }
    }

    .tayeb-admin-error-icon {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        background: #fef2f2;
        color: #dc2626;
        font-size: 18px;
        font-weight: 900;
    }

    .tayeb-admin-access-error h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
    }

    .tayeb-admin-topbar {
        position: sticky;
        top: 0;
        z-index: 100;
        min-height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 10px clamp(15px, 4vw, 45px);
        background: rgba(255,255,255,.96);
        border-bottom: 1px solid #e5e7eb;
        backdrop-filter: blur(18px);
    }

    .tayeb-admin-brand,
    .tayeb-admin-top-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .tayeb-admin-brand-title {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .tayeb-admin-brand-title strong {
        color: #111827;
        font-size: 12px;
        font-weight: 900;
    }

    .tayeb-admin-brand-title span {
        color: #9ca3af;
        font-size: 7px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .12em;
    }

    .tayeb-admin-language {
        display: flex;
        gap: 3px;
        padding: 3px;
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
    }

    .tayeb-admin-language button {
        border: 0;
        background: transparent;
        color: #9ca3af;
        padding: 6px 8px;
        border-radius: 7px;
        font-size: 8px;
        font-weight: 900;
        cursor: pointer;
    }

    .tayeb-admin-language button.active {
        background: #fff7ed;
        color: #f97316;
    }

    .tayeb-admin-refresh {
        min-height: 35px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 11px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #ffffff;
        color: #374151;
        font-size: 8px;
        font-weight: 800;
        cursor: pointer;
    }

    .tayeb-admin-refresh:hover {
        color: #ea580c;
        border-color: #fed7aa;
        background: #fffaf5;
    }

    .tayeb-admin-refresh:disabled {
        opacity: .55;
        cursor: not-allowed;
    }

    .tayeb-admin-avatar,
    .tayeb-admin-user-avatar {
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #f97316;
        color: #ffffff;
        font-weight: 900;
    }

    .tayeb-admin-avatar {
        width: 36px;
        height: 36px;
        font-size: 10px;
    }

    .tayeb-admin-layout {
        min-height: calc(100vh - 72px);
        display: grid;
        grid-template-columns: 215px minmax(0, 1fr);
    }

    .tayeb-admin-sidebar {
        position: sticky;
        top: 72px;
        height: calc(100vh - 72px);
        display: flex;
        flex-direction: column;
        padding: 25px 13px;
        background: #ffffff;
        border-right: 1px solid #e5e7eb;
    }

    .tayeb-admin-sidebar-title {
        padding: 0 12px 15px;
        color: #f97316;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: .2em;
    }

    .tayeb-admin-sidebar nav {
        display: grid;
        gap: 4px;
    }

    .tayeb-admin-sidebar nav button {
        min-height: 43px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 12px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: #6b7280;
        text-align: left;
        font-size: 9px;
        font-weight: 800;
        cursor: pointer;
    }

    .tayeb-admin-sidebar nav button:hover {
        background: #fff7ed;
        color: #ea580c;
    }

    .tayeb-admin-sidebar nav button.active {
        background: #fff7ed;
        color: #ea580c;
    }

    .tayeb-admin-sidebar nav button span {
        width: 25px;
        text-align: center;
        font-size: 14px;
    }

    .tayeb-admin-sidebar-bottom {
        margin-top: auto;
    }

    .tayeb-admin-free-card {
        display: flex;
        gap: 9px;
        padding: 12px;
        margin-bottom: 10px;
        border: 1px solid #fed7aa;
        border-radius: 15px;
        background: #fffaf5;
    }

    .tayeb-admin-free-card > span {
        width: 25px;
        height: 25px;
        flex: 0 0 25px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: #f97316;
        color: white;
        font-size: 9px;
        font-weight: 900;
    }

    .tayeb-admin-free-card strong {
        display: block;
        color: #374151;
        font-size: 8px;
        font-weight: 900;
    }

    .tayeb-admin-free-card small {
        display: block;
        margin-top: 3px;
        color: #9ca3af;
        font-size: 7px;
        line-height: 1.4;
    }

    .tayeb-admin-logout {
        width: 100%;
        min-height: 40px;
        border: 1px solid #e5e7eb;
        border-radius: 11px;
        background: #ffffff;
        color: #6b7280;
        font-size: 8px;
        font-weight: 800;
        cursor: pointer;
    }

    .tayeb-admin-logout:hover {
        color: #dc2626;
        border-color: #fecaca;
        background: #fef2f2;
    }

    .tayeb-admin-main {
        min-width: 0;
        padding: clamp(22px, 4vw, 42px);
    }

    .tayeb-admin-mobile-nav {
        display: none;
    }

    .tayeb-admin-heading {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 28px;
    }

    .tayeb-admin-heading > div > span,
    .tayeb-admin-section-head > div > span,
    .tayeb-admin-panel-head > div > span {
        color: #f97316;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: .18em;
    }

    .tayeb-admin-heading h1 {
        margin: 7px 0 0;
        color: #111827;
        font-size: clamp(28px, 4vw, 43px);
        line-height: 1;
        letter-spacing: -.055em;
        font-weight: 900;
    }

    .tayeb-admin-heading p {
        margin: 10px 0 0;
        color: #6b7280;
        font-size: 10px;
    }

    .tayeb-admin-inline-error {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 11px 13px;
        margin-bottom: 20px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fef2f2;
        color: #b91c1c;
        font-size: 9px;
        font-weight: 800;
    }

    .tayeb-admin-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 11px;
        margin-bottom: 12px;
    }

    .tayeb-admin-stat {
        min-height: 105px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        box-shadow: 0 7px 22px rgba(17,24,39,.04);
    }

    .tayeb-admin-stat-icon {
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        display: grid;
        place-items: center;
        border-radius: 13px;
        background: #fff7ed;
        font-size: 18px;
    }

    .tayeb-admin-stat strong {
        display: block;
        color: #111827;
        font-size: 25px;
        line-height: 1;
        font-weight: 900;
    }

    .tayeb-admin-stat span {
        display: block;
        margin-top: 5px;
        color: #9ca3af;
        font-size: 7px;
        font-weight: 800;
    }

    .tayeb-admin-mini-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 18px;
    }

    .tayeb-admin-mini-stat {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 13px 15px;
        border: 1px solid #e5e7eb;
        border-radius: 15px;
        background: #ffffff;
    }

    .tayeb-admin-mini-stat > span {
        font-size: 15px;
    }

    .tayeb-admin-mini-stat strong {
        display: block;
        color: #111827;
        font-size: 15px;
        font-weight: 900;
    }

    .tayeb-admin-mini-stat small {
        display: block;
        margin-top: 2px;
        color: #9ca3af;
        font-size: 7px;
        font-weight: 800;
    }

    .tayeb-admin-two-column {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
        margin-bottom: 15px;
    }

    .tayeb-admin-panel {
        margin-bottom: 15px;
        padding: 20px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        box-shadow: 0 7px 22px rgba(17,24,39,.04);
    }

    .tayeb-admin-panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
    }

    .tayeb-admin-panel-head h2,
    .tayeb-admin-section-head h2 {
        margin: 6px 0 0;
        color: #111827;
        font-size: 18px;
        font-weight: 900;
    }

    .tayeb-admin-list {
        display: grid;
    }

    .tayeb-admin-list-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 0;
        border-bottom: 1px solid #f1f5f9;
    }

    .tayeb-admin-list-item:last-child {
        border-bottom: 0;
    }

    .tayeb-admin-list-icon,
    .tayeb-admin-user-avatar {
        width: 36px;
        height: 36px;
        flex: 0 0 36px;
    }

    .tayeb-admin-list-icon {
        display: grid;
        place-items: center;
        border-radius: 11px;
        background: #fff7ed;
        font-size: 15px;
    }

    .tayeb-admin-user-avatar {
        font-size: 9px;
    }

    .tayeb-admin-list-main {
        flex: 1;
        min-width: 0;
    }

    .tayeb-admin-list-main strong {
        display: block;
        overflow: hidden;
        color: #111827;
        font-size: 9px;
        font-weight: 900;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tayeb-admin-list-main span {
        display: block;
        margin-top: 3px;
        overflow: hidden;
        color: #6b7280;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tayeb-admin-list-main small {
        display: block;
        margin-top: 3px;
        color: #9ca3af;
        font-size: 7px;
    }

    .tayeb-admin-list-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
        flex-shrink: 0;
    }

    .tayeb-admin-list-side strong {
        color: #ea580c;
        font-size: 9px;
        font-weight: 900;
    }

    .tayeb-admin-list-side small {
        color: #9ca3af;
        font-size: 7px;
    }

    .tayeb-dot-status {
        color: #9ca3af;
        font-size: 11px;
    }

    .tayeb-dot-status.available {
        color: #16a34a;
    }

    .tayeb-status-badge,
    .tayeb-role-badge,
    .tayeb-availability {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        font-size: 7px;
        font-weight: 900;
        white-space: nowrap;
    }

    .tayeb-status-badge.orange {
        background: #fff7ed;
        color: #ea580c;
    }

    .tayeb-status-badge.success {
        background: #f0fdf4;
        color: #16a34a;
    }

    .tayeb-status-badge.danger {
        background: #fef2f2;
        color: #dc2626;
    }

    .tayeb-role-badge {
        background: #f8fafc;
        color: #475569;
    }

    .tayeb-availability.available {
        background: #f0fdf4;
        color: #16a34a;
    }

    .tayeb-availability.busy {
        background: #f3f4f6;
        color: #6b7280;
    }

    .tayeb-admin-section-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 15px;
        margin-bottom: 20px;
    }

    .tayeb-admin-section-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .tayeb-admin-count {
        min-width: 31px;
        height: 31px;
        display: grid;
        place-items: center;
        padding: 0 8px;
        border-radius: 10px;
        background: #fff7ed;
        color: #ea580c;
        font-size: 9px;
        font-weight: 900;
    }

    .tayeb-admin-search {
        width: min(230px, 35vw);
        height: 35px;
        padding: 0 11px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        outline: none;
        background: white;
        color: #111827;
        font-size: 8px;
    }

    .tayeb-admin-search:focus {
        border-color: #f97316;
        box-shadow: 0 0 0 3px rgba(249,115,22,.08);
    }

    .tayeb-admin-table-wrap {
        overflow-x: auto;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 19px;
        box-shadow: 0 7px 22px rgba(17,24,39,.04);
    }

    .tayeb-admin-table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
    }

    .tayeb-admin-table th {
        padding: 13px 15px;
        background: #fafafa;
        border-bottom: 1px solid #e5e7eb;
        color: #9ca3af;
        text-align: left;
        font-size: 7px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .08em;
    }

    .tayeb-admin-table td {
        padding: 14px 15px;
        border-bottom: 1px solid #f1f5f9;
        color: #4b5563;
        font-size: 8px;
        vertical-align: middle;
    }

    .tayeb-admin-table tr:last-child td {
        border-bottom: 0;
    }

    .tayeb-admin-table td strong {
        color: #111827;
        font-size: 8px;
        font-weight: 900;
    }

    .tayeb-table-user {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .tayeb-table-sub {
        display: block;
        margin-top: 4px;
        color: #9ca3af;
        font-size: 7px;
    }

    .tayeb-admin-empty {
        min-height: 170px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
    }

    .tayeb-admin-empty > div {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 15px;
        background: #fff7ed;
        font-size: 20px;
    }

    .tayeb-admin-empty p {
        margin: 0;
        color: #9ca3af;
        font-size: 9px;
    }

    .tayeb-admin-notifications {
        display: grid;
        gap: 9px;
    }

    .tayeb-admin-notification {
        display: flex;
        gap: 12px;
        padding: 15px;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        background: #ffffff;
    }

    .tayeb-admin-notification.unread {
        border-color: #fed7aa;
        background: #fffaf5;
    }

    .tayeb-admin-notification-icon {
        width: 37px;
        height: 37px;
        flex: 0 0 37px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #fff7ed;
    }

    .tayeb-admin-notification-content {
        min-width: 0;
    }

    .tayeb-admin-notification-content strong {
        display: block;
        color: #111827;
        font-size: 10px;
        font-weight: 900;
    }

    .tayeb-admin-notification-content p {
        margin: 5px 0 0;
        color: #6b7280;
        font-size: 9px;
        line-height: 1.5;
    }

    .tayeb-admin-notification-content small {
        display: block;
        margin-top: 7px;
        color: #9ca3af;
        font-size: 7px;
    }

    @media (max-width: 1050px) {
        .tayeb-admin-stat-grid {
            grid-template-columns: repeat(3, 1fr);
        }

        .tayeb-admin-layout {
            grid-template-columns: 175px minmax(0, 1fr);
        }
    }

    @media (max-width: 820px) {
        .tayeb-admin-sidebar {
            display: none;
        }

        .tayeb-admin-layout {
            display: block;
        }

        .tayeb-admin-mobile-nav {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding-bottom: 14px;
            margin-bottom: 5px;
        }

        .tayeb-admin-mobile-nav button {
            min-height: 36px;
            display: flex;
            align-items: center;
            gap: 5px;
            flex-shrink: 0;
            padding: 0 10px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: white;
            color: #6b7280;
            font-size: 7px;
            font-weight: 800;
            cursor: pointer;
        }

        .tayeb-admin-mobile-nav button.active {
            border-color: #fed7aa;
            background: #fff7ed;
            color: #ea580c;
        }

        .tayeb-admin-two-column {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 650px) {
        .tayeb-admin-topbar {
            padding: 9px 12px;
        }

        .tayeb-admin-brand-title {
            display: none;
        }

        .tayeb-admin-refresh span {
            display: none;
        }

        .tayeb-admin-main {
            padding: 17px 12px 30px;
        }

        .tayeb-admin-stat-grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .tayeb-admin-mini-grid {
            grid-template-columns: 1fr;
        }

        .tayeb-admin-heading h1 {
            font-size: 29px;
        }

        .tayeb-admin-section-head {
            align-items: flex-start;
            flex-direction: column;
        }

        .tayeb-admin-section-actions {
            width: 100%;
        }

        .tayeb-admin-search {
            width: 100%;
            flex: 1;
        }

        .tayeb-admin-panel {
            padding: 15px;
            border-radius: 16px;
        }
    }

    @media (max-width: 400px) {
        .tayeb-admin-stat {
            min-height: 90px;
            padding: 12px;
        }

        .tayeb-admin-stat strong {
            font-size: 21px;
        }

        .tayeb-admin-stat-icon {
            width: 35px;
            height: 35px;
            flex-basis: 35px;
            font-size: 15px;
        }

        .tayeb-admin-language button {
            padding: 5px 6px;
        }

        .tayeb-admin-avatar {
            width: 32px;
            height: 32px;
        }
    }
`;


/* =========================================================
   INJECT STYLES
========================================================= */

if (
    typeof document !==
    "undefined"
) {
    const styleId =
        "tayeb-admin-styles";

    if (
        !document.getElementById(
            styleId
        )
    ) {
        const style =
            document.createElement(
                "style"
            );

        style.id =
            styleId;

        style.innerHTML =
            adminStyles;

        document.head.appendChild(
            style
        );
    }
}