import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/getCurrentUser";
import { logout } from "../lib/logout";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";
import Notifications from "../components/Notifications";

export default function DriverPage() {


    const router = useRouter();

    const { language, changeLanguage, t } = useLanguage();



    const [user, setUser] = useState(null);

    const [shipments, setShipments] = useState([]);

    const [loading, setLoading] = useState(true);



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

                <div className="flex justify-end mb-4">


                    <button

                        onClick={() => changeLanguage("en")}

                        className={`px-3 py-1 rounded-l-lg text-sm ${language === "en"
                            ? "bg-amber-400 text-slate-900"
                            : "bg-slate-700"
                            }`}

                    >

                        EN

                    </button>





                    <button

                        onClick={() => changeLanguage("fr")}

                        className={`px-3 py-1 rounded-r-lg text-sm ${language === "fr"
                            ? "bg-amber-400 text-slate-900"
                            : "bg-slate-700"
                            }`}

                    >

                        FR

                    </button>


                </div>









                {/* HEADER */}


                <div className="bg-slate-800 rounded-3xl p-5 mb-6">


                    <div className="flex justify-center mb-5">

                        <BrandLogo size="120" />

                    </div>





                    <div className="flex justify-between items-center">


                        <div>


                            <h1 className="text-2xl font-black">

                                {t.welcome},

                            </h1>




                            <p className="text-amber-400 font-bold">

                                {user.full_name}

                            </p>





                            <p className="text-sm text-slate-400">

                                Driver

                            </p>


                        </div>






                        <button

                            onClick={() => logout(router)}

                            className="bg-red-600 px-4 py-2 rounded-xl font-bold"

                        >

                            Logout

                        </button>



                    </div>


                </div>




                <Notifications userId={user.id} />







                {/* AVAILABILITY */}


                <div className="bg-slate-800 rounded-3xl p-5 mb-5">


                    <div className="flex justify-between items-center">


                        <div>


                            <h2 className="font-black">

                                Availability

                            </h2>




                            <p className="text-sm text-slate-400">


                                {
                                    available

                                        ? "🟢 Available"

                                        : "🔴 Busy"
                                }


                            </p>


                        </div>







                        <button


                            onClick={toggleAvailability}


                            className={`px-5 py-2 rounded-xl font-black ${available
                                ? "bg-green-600"
                                : "bg-red-600"
                                }`}


                        >

                            {
                                available
                                    ? "ON"
                                    : "OFF"
                            }


                        </button>



                    </div>


                </div>













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












                {/* SUMMARY */}


                <div className="grid grid-cols-3 gap-3 mb-6">



                    <SummaryCard

                        value={availableJobs.length}

                        title="Jobs"

                    />




                    <SummaryCard

                        value={activeJobs.length}

                        title="Active"

                    />




                    <SummaryCard

                        value={completedJobs.length}

                        title="Done"

                    />


                </div>












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


                            :


                            shipments.map((item) => (


                                <div

                                    key={item.id}

                                    className="bg-slate-800 rounded-3xl p-5 mb-5"

                                >


                                    <div className="flex justify-between">


                                        <div>


                                            <h2 className="font-black text-lg">

                                                {item.item_type}

                                            </h2>



                                            <p className="text-sm text-slate-300">

                                                {item.quantity} units

                                            </p>


                                        </div>





                                        <div className="text-amber-400 font-black">

                                            {item.initial_offer} FCFA

                                        </div>


                                    </div>






                                    <div className="mt-4 space-y-2 text-sm">


                                        <p>

                                            📍 {item.origin}

                                        </p>


                                        <p>

                                            🏁 {item.destination}

                                        </p>


                                        <p>

                                            📞 Receiver:
                                            {" "}
                                            {item.receiver_phone}

                                        </p>



                                        {
                                            item.shipper &&

                                            <>

                                                <p className="mt-3 font-bold text-amber-400">

                                                    Shipper Details

                                                </p>


                                                <p>

                                                    👤 {item.shipper.full_name}

                                                </p>


                                                <p>

                                                    📱 {item.shipper.phone_number}

                                                </p>

                                            </>

                                        }


                                        <p className="font-bold">

                                            Status:
                                            {" "}
                                            {item.status}

                                        </p>


                                    </div>                            {/* DELIVERY TRACKING */}


                                    <div className="mt-5 bg-slate-700 rounded-2xl p-3">


                                        <p className="font-bold mb-2">

                                            Delivery Progress

                                        </p>





                                        <div className="flex justify-between text-xs">



                                            <span

                                                className={
                                                    item.status !== "OPEN"

                                                        ?

                                                        "text-amber-400 font-bold"

                                                        :

                                                        ""
                                                }

                                            >

                                                Accepted

                                            </span>







                                            <span

                                                className={
                                                    item.status === "DEPARTED" ||
                                                        item.status === "ARRIVED" ||
                                                        item.status === "COMPLETED"

                                                        ?

                                                        "text-amber-400 font-bold"

                                                        :

                                                        ""
                                                }

                                            >

                                                On Way

                                            </span>








                                            <span

                                                className={
                                                    item.status === "COMPLETED"

                                                        ?

                                                        "text-green-400 font-bold"

                                                        :

                                                        ""
                                                }

                                            >

                                                Delivered

                                            </span>



                                        </div>


                                    </div>












                                    {/* ACTION BUTTONS */}



                                    <div className="mt-5">






                                        {
                                            item.status === "OPEN" &&


                                            <button


                                                onClick={() =>
                                                    updateStatus(
                                                        item.id,
                                                        "MATCHED"
                                                    )
                                                }


                                                className="w-full bg-amber-400 text-slate-900 rounded-xl py-3 font-black"


                                            >

                                                ACCEPT SHIPMENT


                                            </button>


                                        }









                                        {
                                            item.status === "MATCHED" &&
                                            item.driver_id === user.id &&


                                            <button


                                                onClick={() =>
                                                    updateStatus(
                                                        item.id,
                                                        "DEPARTED"
                                                    )
                                                }


                                                className="w-full bg-orange-500 rounded-xl py-3 font-black"


                                            >

                                                START JOURNEY


                                            </button>


                                        }









                                        {
                                            item.status === "DEPARTED" &&
                                            item.driver_id === user.id &&


                                            <button


                                                onClick={() =>
                                                    updateStatus(
                                                        item.id,
                                                        "ARRIVED"
                                                    )
                                                }


                                                className="w-full bg-green-600 rounded-xl py-3 font-black"


                                            >

                                                ARRIVED


                                            </button>


                                        }









                                        {
                                            item.status === "ARRIVED" &&
                                            item.driver_id === user.id &&


                                            <button


                                                onClick={() =>
                                                    updateStatus(
                                                        item.id,
                                                        "COMPLETED"
                                                    )
                                                }


                                                className="w-full bg-blue-600 rounded-xl py-3 font-black"


                                            >

                                                COMPLETE DELIVERY


                                            </button>


                                        }





                                    </div>





                                </div>


                            ))


                }








            </main>


        </div>


    );


}









function SummaryCard({ value, title }) {


    return (


        <div className="bg-slate-800 rounded-2xl p-3 text-center">


            <p className="text-xl font-black">

                {value}

            </p>





            <p className="text-xs text-slate-400">

                {title}

            </p>


        </div>


    );


}