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

    async function submitBid(bid) {
        const { error } = await supabase
            .from("bids")
            .insert([
                {
                    shipment_id: selectedShipment.id,
                    driver_id: user.id,
                    proposed_price: bid.price,
                    eta: bid.eta,
                    note: bid.note,
                    status: "PENDING",
                },
            ]);
        if (error) {
            alert(error.message);
            return;
        }

        alert("Bid submitted successfully.");

        setBidModalOpen(false);
        setSelectedShipment(null);
    }


    // DRIVER AVAILABILITY

    const [available, setAvailable] = useState(true);



    // SUBSCRIPTION

    const [momoTxid, setMomoTxid] = useState("");

    const [subscriptionLoading, setSubscriptionLoading] = useState(false);

    const [subscriptionStatus, setSubscriptionStatus] = useState(null);





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








    async function loadDriverData(currentUser) {


        const { data, error } = await supabase

            .from("users")

            .select("*")

            .eq("id", currentUser.id)

            .single();





        if (!error && data) {


            setAvailable(
                data.is_available ?? true
            );


            setUser(data);


        }



        checkSubscription(currentUser.id);



        fetchShipments(currentUser.id);



    }









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

                ascending: false

            });






        if (error) {


            alert(error.message);


        } else {


            setShipments(data || []);
            const { data: bids } = await supabase
                .from("bids")
                .select("shipment_id,status")
                .eq("driver_id", driverId);

            setDriverBids(bids || []);


        }



        setLoading(false);


    }









    async function toggleAvailability() {


        const newStatus = !available;



        const { error } = await supabase

            .from("users")

            .update({

                is_available: newStatus,

                last_seen: new Date().toISOString()

            })

            .eq("id", user.id);





        if (error) {


            alert(error.message);

            return;


        }




        setAvailable(newStatus);



    }









    async function checkSubscription(userId) {


        const { data, error } = await supabase

            .from("subscriptions")

            .select("*")

            .eq("user_id", userId)

            .order("created_at", {

                ascending: false

            })

            .limit(1)

            .maybeSingle();





        if (!error && data) {


            setSubscriptionStatus(
                data.status
            );


        }



    }









    async function submitSubscription() {


        if (!momoTxid.trim()) {


            alert(
                "Enter Mobile Money transaction ID"
            );


            return;


        }





        setSubscriptionLoading(true);





        const { error } = await supabase

            .from("subscriptions")

            .insert([

                {

                    user_id: user.id,

                    momo_txid: momoTxid,

                    amount: 5000,

                    status: "PENDING",

                }

            ]);






        setSubscriptionLoading(false);






        if (error) {


            alert(error.message);

            return;


        }






        setSubscriptionStatus(
            "PENDING"
        );


        setMomoTxid("");



        alert(
            "Subscription request sent. Waiting for approval."
        );


    }









    async function updateStatus(id, status) {



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
                            "application/json"

                    },

                    body: JSON.stringify({

                        shipmentId: id,

                        eventType: status,

                    })

                }
            );



        } catch (error) {


            console.log(
                "Notification error:",
                error
            );


        }






        fetchShipments(user.id);



    } if (!user) return null;





    const activeJobs = shipments.filter(

        item =>

            item.driver_id === user.id &&

            item.status !== "COMPLETED"

    );






    const availableJobs = shipments.filter(

        item =>

            item.status === "OPEN"

    );






    const completedJobs = shipments.filter(

        item =>

            item.status === "COMPLETED"

    );










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



                <Notifications userId={user.id} />







                {/* AVAILABILITY */}


                <AvailabilityCard
                    available={available}
                    toggleAvailability={toggleAvailability}
                />


                {/* SUBSCRIPTION */}



                <div className="bg-slate-800 rounded-3xl p-5 mb-5">


                    <h2 className="font-black text-lg mb-3">

                        Subscription

                    </h2>





                    {
                        subscriptionStatus === "APPROVED"

                            ?

                            <p className="text-green-400 font-bold">

                                Active Subscription

                            </p>


                            :


                            subscriptionStatus === "PENDING"


                                ?

                                <p className="text-amber-400 font-bold">

                                    Waiting for approval

                                </p>


                                :


                                <>

                                    <p className="text-sm text-slate-400 mb-3">

                                        Monthly access: 5000 FCFA

                                    </p>



                                    <input

                                        value={momoTxid}

                                        onChange={(e) =>
                                            setMomoTxid(e.target.value)
                                        }

                                        placeholder="Mobile Money Transaction ID"

                                        className="w-full p-3 rounded-xl text-black mb-3"

                                    />





                                    <button

                                        onClick={submitSubscription}

                                        disabled={subscriptionLoading}

                                        className="w-full bg-amber-400 text-slate-900 rounded-xl py-3 font-black"

                                    >

                                        {
                                            subscriptionLoading

                                                ? "Sending..."

                                                : "Submit Subscription"
                                        }


                                    </button>


                                </>

                    }


                </div>











                <SummaryCards
                    availableJobs={availableJobs}
                    activeJobs={activeJobs}
                    completedJobs={completedJobs}
                />












                {/* SHIPMENTS START */}

                {

                    loading


                        ?


                        (

                            <div className="text-center py-10">

                                Loading...

                            </div>

                        )


                        :


                        shipments.length === 0


                            ?


                            (

                                <div className="bg-slate-800 rounded-3xl p-8 text-center">

                                    No shipments available.

                                </div>

                            )

                            : (

                                <>
                                    {shipments.map((item) => (
                                        <ShipmentCard
                                            key={item.id}
                                            item={item}
                                            user={user}
                                            hasBid={
                                                driverBids.some(
                                                    bid => bid.shipment_id === item.id
                                                )
                                            }
                                            updateStatus={updateStatus}
                                            onBid={(shipment) => {
                                                setSelectedShipment(shipment);
                                                setBidModalOpen(true);
                                            }}
                                        />

                                    ))}
                                </>
                            )}


                <BidModal
                    open={bidModalOpen}
                    shipment={selectedShipment}
                    onClose={() => {
                        setBidModalOpen(false);
                        setSelectedShipment(null);
                    }}
                    onSubmit={submitBid}
                />

                <DeleteAccount user={user} />

            </main >


        </div >


    );


}









