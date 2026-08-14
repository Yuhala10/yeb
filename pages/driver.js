import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/getCurrentUser";
import { useLanguage } from "../lib/LanguageContext";
import Notifications from "../components/Notifications";
import SummaryCards from "../components/Driver/SummaryCards";
import DriverHeader from "../components/Driver/DriverHeader";
import AvailabilityCard from "../components/Driver/AvailabilityCard";
import ShipmentCard from "../components/Driver/ShipmentCard";
import BidModal from "../components/Driver/BidModal";
import DeleteAccount from "../components/Account/DeleteAccount";

export default function DriverPage() {
    const router = useRouter();

    const { language, changeLanguage, t } = useLanguage();

    const [user, setUser] = useState(null);

    const [shipments, setShipments] = useState([]);

    const [loading, setLoading] = useState(true);

    const [selectedShipment, setSelectedShipment] = useState(null);

    const [bidModalOpen, setBidModalOpen] = useState(false);

    const [driverBids, setDriverBids] = useState([]);

    // DRIVER AVAILABILITY
    const [available, setAvailable] = useState(true);


    // =========================================================
    // INITIAL DRIVER LOGIN / LOAD
    // =========================================================

    useEffect(() => {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            router.push("/login");
            return;
        }

        if (currentUser.role !== "DRIVER") {
            router.push("/");
            return;
        }

        setUser(currentUser);

        loadDriverData(currentUser);
    }, []);


    // =========================================================
    // REALTIME UPDATES
    // =========================================================

    useEffect(() => {
        if (!user?.id) return;

        const shipmentChannel = supabase
            .channel(`driver-shipments-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "shipments",
                },
                () => {
                    fetchShipments(user.id);
                }
            )
            .subscribe();

        const bidChannel = supabase
            .channel(`driver-bids-${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "bids",
                    filter: `driver_id=eq.${user.id}`,
                },
                () => {
                    fetchShipments(user.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(shipmentChannel);
            supabase.removeChannel(bidChannel);
        };
    }, [user]);


    // =========================================================
    // LOAD DRIVER DATA
    // =========================================================

    async function loadDriverData(currentUser) {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", currentUser.id)
            .single();

        if (!error && data) {
            setAvailable(data.is_available ?? true);

            setUser(data);

            // Keep local saved user up to date
            localStorage.setItem(
                "tayebUser",
                JSON.stringify(data)
            );
        }

        fetchShipments(currentUser.id);
    }


    // =========================================================
    // FETCH DRIVER SHIPMENTS + BIDS
    // =========================================================

    async function fetchShipments(driverId) {
        setLoading(true);

        const { data, error } = await supabase
            .from("shipments")
            .select(`
                *,
                shipper:shipper_id (
                    full_name,
                    phone_number
                )
            `)
            .or(
                `status.eq.OPEN,driver_id.eq.${driverId}`
            )
            .order("created_at", {
                ascending: false,
            });

        if (error) {
            alert(error.message);
        } else {
            setShipments(data || []);

            const { data: bids, error: bidsError } =
                await supabase
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
                    .eq("driver_id", driverId);

            if (bidsError) {
                console.log(
                    "Driver bids error:",
                    bidsError
                );
            }

            setDriverBids(bids || []);
        }

        setLoading(false);
    }


    // =========================================================
    // DRIVER SENDS FIRST PRICE
    // =========================================================

    async function submitBid(bid) {
        if (!selectedShipment || !user) return;

        const price = Number(bid.price);

        if (!price || price <= 0) {
            alert("Please enter a valid price.");
            return;
        }

        const { data: newBid, error } = await supabase
            .from("bids")
            .insert([
                {
                    shipment_id: selectedShipment.id,
                    driver_id: user.id,
                    proposed_price: price,
                    counter_price: null,
                    last_offer_by: "DRIVER",
                    eta: bid.eta,
                    note: bid.note,
                    status: "PENDING",
                },
            ])
            .select()
            .single();

        if (error) {
            alert(error.message);
            return;
        }

        // =========================================================
        // NOTIFY SHIPPER THAT DRIVER SENT A PRICE
        // =========================================================

        try {
            await fetch("/api/send-notification", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    shipmentId: selectedShipment.id,
                    eventType: "BID_RECEIVED",
                    targetUserId: selectedShipment.shipper_id,
                }),
            });
        } catch (notificationError) {
            console.log(
                "Bid notification error:",
                notificationError
            );
        }

        alert(
            "Your price has been sent to the shipper."
        );

        await fetchShipments(user.id);

        setBidModalOpen(false);
        setSelectedShipment(null);
    }


    // =========================================================
    // DRIVER ACCEPTS SHIPPER'S COUNTER PRICE
    // =========================================================

    async function acceptCounterPrice(bid) {
        if (!user) return;

        if (
            !bid?.id ||
            bid.counter_price === null ||
            bid.counter_price === undefined
        ) {
            alert("There is no new price to accept.");
            return;
        }

        const finalPrice = Number(
            bid.counter_price
        );

        if (!finalPrice || finalPrice <= 0) {
            alert("Invalid price.");
            return;
        }

        // First save the agreed price and selected driver
        const { error: shipmentError } =
            await supabase
                .from("shipments")
                .update({
                    driver_id: user.id,
                    driver_name: user.full_name,
                    driver_phone: user.phone_number,
                    agreed_price: finalPrice,
                    status: "MATCHED",
                    matched_at:
                        new Date().toISOString(),
                })
                .eq("id", bid.shipment_id)
                .eq("status", "OPEN");

        if (shipmentError) {
            alert(shipmentError.message);
            return;
        }

        // Mark this bid as accepted
        const { error: bidError } =
            await supabase
                .from("bids")
                .update({
                    proposed_price: finalPrice,
                    counter_price: null,
                    last_offer_by: "DRIVER",
                    status: "ACCEPTED",
                })
                .eq("id", bid.id)
                .eq("driver_id", user.id);

        if (bidError) {
            alert(bidError.message);
            return;
        }

        // Reject all other drivers' offers
        const { error: rejectError } =
            await supabase
                .from("bids")
                .update({
                    status: "REJECTED",
                })
                .eq("shipment_id", bid.shipment_id)
                .neq("id", bid.id);

        if (rejectError) {
            console.log(
                "Other bids rejection error:",
                rejectError
            );
        }

        alert(
            "Price agreed! You can now contact the shipper."
        );

        await fetchShipments(user.id);
    }


    // =========================================================
    // DRIVER SUGGESTS ANOTHER PRICE
    // =========================================================

    async function suggestAnotherPrice(
        bid,
        newPrice
    ) {
        if (!user) return;

        const price = Number(newPrice);

        if (!price || price <= 0) {
            alert("Please enter a valid price.");
            return;
        }

        if (!bid?.id) {
            alert("Offer information is missing.");
            return;
        }

        const { error } = await supabase
            .from("bids")
            .update({
                counter_price: price,
                last_offer_by: "DRIVER",
                status: "COUNTERED",
            })
            .eq("id", bid.id)
            .eq("driver_id", user.id);

        if (error) {
            alert(error.message);
            return;
        }

        alert(
            "Your new price has been sent to the shipper."
        );

        await fetchShipments(user.id);
    }


    // =========================================================
    // DRIVER AVAILABILITY
    // =========================================================

    async function toggleAvailability() {
        if (!user) return;

        const newStatus = !available;

        const { error } = await supabase
            .from("users")
            .update({
                is_available: newStatus,
                last_seen:
                    new Date().toISOString(),
            })
            .eq("id", user.id);

        if (error) {
            alert(error.message);
            return;
        }

        setAvailable(newStatus);

        const updatedUser = {
            ...user,
            is_available: newStatus,
            last_seen:
                new Date().toISOString(),
        };

        setUser(updatedUser);

        localStorage.setItem(
            "tayebUser",
            JSON.stringify(updatedUser)
        );
    }


    // =========================================================
    // DELIVERY STATUS
    // =========================================================

    async function updateStatus(id, status) {
        if (!user) return;

        if (
            !available &&
            status === "MATCHED"
        ) {
            alert(
                "You are currently unavailable."
            );

            return;
        }

        const updates = {
            status: status,
        };

        if (status === "MATCHED") {
            updates.driver_id = user.id;

            updates.driver_name =
                user.full_name;

            updates.driver_phone =
                user.phone_number;

            updates.matched_at =
                new Date().toISOString();
        }

        if (status === "DEPARTED") {
            updates.departed_at =
                new Date().toISOString();
        }

        if (status === "ARRIVED") {
            updates.arrived_at =
                new Date().toISOString();
        }

        if (status === "COMPLETED") {
            updates.completed_at =
                new Date().toISOString();
        }

        const { error } = await supabase
            .from("shipments")
            .update(updates)
            .eq("id", id);

        if (error) {
            alert(error.message);
            return;
        }

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
                        shipmentId: id,
                        eventType: status,
                    }),
                }
            );
        } catch (error) {
            console.log(
                "Notification error:",
                error
            );
        }

        fetchShipments(user.id);
    }


    if (!user) return null;


    // =========================================================
    // DASHBOARD DATA
    // =========================================================

    const activeJobs = shipments.filter(
        (item) =>
            item.driver_id === user.id &&
            item.status !== "COMPLETED"
    );

    const availableJobs = shipments.filter(
        (item) =>
            item.status === "OPEN"
    );

    const completedJobs = shipments.filter(
        (item) =>
            item.status === "COMPLETED"
    );


    // =========================================================
    // PAGE
    // =========================================================

    return (
        <div className="min-h-screen bg-slate-900 text-white pb-10">

            <main className="max-w-md mx-auto p-5">

                {/* LANGUAGE */}

                <DriverHeader
                    user={user}
                    router={router}
                    t={t}
                    language={language}
                    changeLanguage={changeLanguage}
                />

                <Notifications
                    userId={user.id}
                />


                {/* AVAILABILITY */}

                <AvailabilityCard
                    available={available}
                    toggleAvailability={
                        toggleAvailability
                    }
                />


                {/* SUMMARY */}

                <SummaryCards
                    availableJobs={availableJobs}
                    activeJobs={activeJobs}
                    completedJobs={completedJobs}
                />


                {/* SHIPMENTS */}

                {
                    loading
                        ? (
                            <div className="text-center py-10">
                                Loading...
                            </div>
                        )
                        : shipments.length === 0
                            ? (
                                <div className="bg-slate-800 rounded-3xl p-8 text-center">
                                    No shipments available.
                                </div>
                            )
                            : (
                                <>
                                    {shipments.map(
                                        (item) => {

                                            const driverBid =
                                                driverBids.find(
                                                    (bid) =>
                                                        bid.shipment_id ===
                                                        item.id
                                                );

                                            return (
                                                <ShipmentCard
                                                    key={item.id}
                                                    item={item}
                                                    user={user}
                                                    driverBid={
                                                        driverBid
                                                    }
                                                    updateStatus={
                                                        updateStatus
                                                    }
                                                    onBid={(
                                                        shipment
                                                    ) => {
                                                        setSelectedShipment(
                                                            shipment
                                                        );

                                                        setBidModalOpen(
                                                            true
                                                        );
                                                    }}
                                                    onAcceptCounterPrice={
                                                        acceptCounterPrice
                                                    }
                                                    onSuggestAnotherPrice={
                                                        suggestAnotherPrice
                                                    }
                                                />
                                            );
                                        }
                                    )}
                                </>
                            )
                }


                {/* BID MODAL */}

                <BidModal
                    open={bidModalOpen}
                    shipment={selectedShipment}
                    onClose={() => {
                        setBidModalOpen(false);
                        setSelectedShipment(null);
                    }}
                    onSubmit={submitBid}
                />


                {/* DELETE ACCOUNT */}

                <DeleteAccount
                    user={user}
                />

            </main>

        </div>
    );
}