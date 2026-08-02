import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/getCurrentUser";
import { logout } from "../lib/logout";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";
import Notifications from "../components/Notifications";
import DeleteAccount from "../components/Account/DeleteAccount";


export default function ShipperPage() {


    const router = useRouter();


    const { language, changeLanguage, t } = useLanguage();



    const [user, setUser] = useState(null);

    const [shipments, setShipments] = useState([]);



    const [itemType, setItemType] = useState("Bags/Sacks");

    const [origin, setOrigin] = useState("Douala (Akwa Market)");

    const [destination, setDestination] = useState("Yaoundé (Mvan Park)");

    const [quantity, setQuantity] = useState(3);

    const [offer, setOffer] = useState(12000);

    const [phone, setPhone] = useState("");



    const [loading, setLoading] = useState(false);

    const [posted, setPosted] = useState(false);

    const [loadingShipments, setLoadingShipments] = useState(true);
    const [bids, setBids] = useState([]);




    // SUBSCRIPTION

    const [momoTxid, setMomoTxid] = useState("");

    const [subscriptionLoading, setSubscriptionLoading] = useState(false);







    useEffect(() => {


        const currentUser = getCurrentUser();



        if (!currentUser) {

            router.push("/login");

            return;

        }





        if (currentUser.role !== "SHIPPER") {

            router.push("/");

            return;

        }






        setUser(currentUser);
        console.log("Logged in user:", currentUser);

        setPhone(currentUser.phone_number || "");



        fetchShipments(currentUser.id);



    }, []);











    async function fetchShipments(shipperId) {



        setLoadingShipments(true);

        console.log("Fetching shipments for:", shipperId);

        const { data, error } = await supabase

            .from("shipments")

            .select(`
                *,
                driver:driver_id (
                    full_name,
                    phone_number
                )
            `)

            .eq("shipper_id", shipperId)

            .order("created_at", {

                ascending: false


            });

        console.log("Shipments returned:", data);






        if (error) {
            alert(error.message);
        } else {

            setShipments(data || []);

            const shipmentIds = (data || []).map((s) => s.id);

            if (shipmentIds.length > 0) {
                const { data: bidsData, error: bidsError } = await supabase
                    .from("bids")
                    .select(`
        *,
        driver:driver_id (
            id,
            full_name,
            phone_number
        )
    `)
                    .in("shipment_id", shipmentIds)
                    .order("created_at", { ascending: true });

                if (bidsError) {
                    console.log(bidsError);
                }

                setBids(bidsData || []);
            } else {
                setBids([]);
            }


        }






        setLoadingShipments(false);



    }



    console.log("Shipments returned:", data);





    async function submitSubscription() {


        if (!momoTxid.trim()) {


            alert("Enter Mobile Money transaction ID");


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

                    status: "PENDING"

                }

            ]);







        setSubscriptionLoading(false);






        if (error) {


            alert(error.message);


            return;


        }





        setMomoTxid("");



        alert(
            "Subscription request sent. Waiting for approval."
        );



    }









    async function handlePostCargo(e) {


        e.preventDefault();



        setLoading(true);






        const { data, error } = await supabase

            .from("shipments")

            .insert([

                {

                    shipper_id: user.id,

                    shipper_name: user.full_name,

                    shipper_phone: user.phone_number,

                    item_type: itemType,

                    origin,

                    destination,

                    quantity,

                    initial_offer: offer,

                    receiver_phone: phone,

                    status: "OPEN"

                }

            ])

            .select()

            .single();







        setLoading(false);






        if (error) {


            alert(error.message);


            return;


        }






        setPosted(true);



        fetchShipments(user.id);



    } if (!user) return null;






    const activeShipments = shipments.filter(

        item => item.status !== "COMPLETED"

    );





    const completedShipments = shipments.filter(

        item => item.status === "COMPLETED"

    );




    async function acceptBid(bid) {
        // Update the shipment with the selected driver
        const { error: shipmentError } = await supabase
            .from("shipments")
            .update({
                driver_id: bid.driver_id,
                driver_name: bid.driver?.full_name,
                driver_phone: bid.driver?.phone_number,
                status: "MATCHED",
                matched_at: new Date().toISOString(),
            })
            .eq("id", bid.shipment_id);

        if (shipmentError) {
            alert(shipmentError.message);
            return;
        }

        // Mark the accepted bid
        await supabase
            .from("bids")
            .update({ status: "ACCEPTED" })
            .eq("id", bid.id);

        // Mark all other bids for this shipment as rejected
        await supabase
            .from("bids")
            .update({ status: "REJECTED" })
            .eq("shipment_id", bid.shipment_id)
            .neq("id", bid.id);

        alert("Driver selected successfully.");

        fetchShipments(user.id);
    }




    async function refreshShipmentStatus(id, status) {


        const updates = {

            status

        };





        if (status === "MATCHED") {

            updates.matched_at = new Date().toISOString();

        }



        if (status === "DEPARTED") {

            updates.departed_at = new Date().toISOString();

        }



        if (status === "ARRIVED") {

            updates.arrived_at = new Date().toISOString();

        }



        if (status === "COMPLETED") {

            updates.completed_at = new Date().toISOString();

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


            await fetch("/api/send-notification", {


                method: "POST",


                headers: {

                    "Content-Type": "application/json"

                },


                body: JSON.stringify({

                    shipmentId: id,

                    eventType: status

                })


            });



        } catch (error) {


            console.log(
                "Notification error:",
                error
            );


        }






        fetchShipments(user.id);



    }









    return (


        <div className="min-h-screen bg-slate-50 pb-10">


            <div className="max-w-md mx-auto p-5">







                {/* LANGUAGE */}



                <div className="flex justify-end mb-4">



                    <button

                        onClick={() => changeLanguage("en")}

                        className={`px-3 py-1 rounded-l-lg text-sm ${language === "en"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200"
                            }`}

                    >

                        EN

                    </button>






                    <button

                        onClick={() => changeLanguage("fr")}

                        className={`px-3 py-1 rounded-r-lg text-sm ${language === "fr"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200"
                            }`}

                    >

                        FR

                    </button>



                </div>









                {/* HEADER */}



                <div className="bg-white rounded-3xl shadow-xl p-5 mb-6">



                    <div className="flex justify-center mb-5">


                        <BrandLogo size="120" />


                    </div>






                    <div className="flex justify-between items-center">



                        <div>


                            <h1 className="text-2xl font-black">


                                {t.welcome},


                            </h1>





                            <p className="text-orange-600 font-bold">


                                {user.full_name}


                            </p>





                            <p className="text-sm text-slate-500">


                                Shipper


                            </p>



                        </div>






                        <button


                            onClick={() => logout(router)}


                            className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold"


                        >

                            Logout


                        </button>



                    </div>



                </div>




                <Notifications userId={user.id} />




                {/* SUBSCRIPTION */}



                <div className="bg-white rounded-3xl shadow-xl p-5 mb-6">



                    <h2 className="font-black text-lg mb-3">


                        Activate Subscription


                    </h2>





                    <p className="text-sm text-slate-500 mb-3">


                        Pay 5000 FCFA and enter your Mobile Money transaction ID.


                    </p>






                    <input


                        value={momoTxid}


                        onChange={(e) => setMomoTxid(e.target.value)}


                        placeholder="Mobile Money Transaction ID"


                        className="w-full border rounded-xl p-3 mb-3"


                    />







                    <button


                        onClick={submitSubscription}


                        disabled={subscriptionLoading}


                        className="w-full bg-orange-600 text-white rounded-xl py-3 font-black"


                    >


                        {

                            subscriptionLoading

                                ?

                                "Sending..."

                                :

                                "Request Activation"

                        }



                    </button>




                </div>









                {/* SUMMARY */}



                <div className="grid grid-cols-3 gap-3 mb-6">


                    <SummaryCard

                        value={shipments.length}

                        title="Posted"

                    />



                    <SummaryCard

                        value={activeShipments.length}

                        title="Active"

                    />



                    <SummaryCard

                        value={completedShipments.length}

                        title="Done"

                    />



                </div>id="92hkd"
                {/* POST SUCCESS */}


                {
                    posted ?


                        (

                            <div className="bg-white rounded-3xl shadow-xl p-8 text-center">


                                <h2 className="text-2xl font-black text-green-600">

                                    Cargo Posted!

                                </h2>




                                <p className="mt-3 text-slate-500">

                                    Drivers can now see your shipment.

                                </p>






                                <button

                                    onClick={() => setPosted(false)}

                                    className="mt-6 w-full bg-slate-900 text-amber-400 rounded-2xl py-4 font-black"

                                >

                                    Post Another Shipment

                                </button>




                            </div>


                        )



                        :



                        (

                            <form

                                onSubmit={handlePostCargo}

                                className="bg-white rounded-3xl shadow-xl p-6 space-y-5"

                            >




                                <h2 className="text-xl font-black">

                                    New Shipment

                                </h2>





                                <select

                                    value={itemType}

                                    onChange={(e) => setItemType(e.target.value)}

                                    className="w-full border rounded-xl p-3"

                                >

                                    <option>
                                        Bags/Sacks
                                    </option>

                                    <option>
                                        Crates/Boxes
                                    </option>

                                    <option>
                                        Drums/Oil
                                    </option>

                                    <option>
                                        Furniture/Bulky
                                    </option>


                                </select>







                                <input

                                    value={origin}

                                    onChange={(e) => setOrigin(e.target.value)}

                                    className="w-full border rounded-xl p-3"

                                    placeholder="Origin"

                                />







                                <input

                                    value={destination}

                                    onChange={(e) => setDestination(e.target.value)}

                                    className="w-full border rounded-xl p-3"

                                    placeholder="Destination"

                                />







                                <input

                                    type="number"

                                    value={quantity}

                                    onChange={(e) => setQuantity(Number(e.target.value))}

                                    className="w-full border rounded-xl p-3"

                                    placeholder="Quantity"

                                />








                                <input

                                    type="number"

                                    value={offer}

                                    onChange={(e) => setOffer(Number(e.target.value))}

                                    className="w-full border rounded-xl p-3"

                                    placeholder="Offer FCFA"

                                />







                                <input

                                    value={phone}

                                    onChange={(e) => setPhone(e.target.value)}

                                    className="w-full border rounded-xl p-3"

                                    placeholder="Receiver Phone"

                                />







                                <button

                                    disabled={loading}

                                    className="w-full bg-orange-600 text-white rounded-2xl py-4 font-black"

                                >

                                    {

                                        loading

                                            ?

                                            "Posting..."

                                            :

                                            "Broadcast Shipment"

                                    }


                                </button>




                            </form>


                        )

                }









                {/* DRIVER MATCH DETAILS */}



                <div className="bg-white rounded-3xl shadow p-5 mt-6">


                    <h2 className="font-black text-lg mb-3">

                        Driver Information

                    </h2>





                    {
                        shipments.some(item => item.driver_id)



                            ?



                            shipments

                                .filter(item => item.driver_id)

                                .map(item => (


                                    <div

                                        key={item.id}

                                        className="border rounded-2xl p-4 mb-3"

                                    >



                                        <p className="font-bold">

                                            Shipment:

                                            {" "}

                                            {item.item_type}

                                        </p>





                                        <p className="mt-2">

                                            🚚 Driver:

                                            {" "}

                                            {
                                                item.driver?.full_name ||
                                                "Matched driver"
                                            }

                                        </p>





                                        <p>

                                            📞

                                            {" "}

                                            {
                                                item.driver?.phone_number ||
                                                "Hidden"
                                            }

                                        </p>





                                        <p className="font-bold mt-2">

                                            Status:

                                            {" "}

                                            {item.status}

                                        </p>




                                    </div>


                                ))



                            :



                            <p className="text-sm text-slate-500">

                                Waiting for driver acceptance.

                            </p>


                    }


                </div>









                {/* DELIVERY TRACKING */}



                <div className="bg-white rounded-3xl shadow p-5 mt-6">


                    <h2 className="font-black text-lg mb-4">

                        Delivery Tracking

                    </h2>





                    {
                        shipments.map(item => (


                            <div

                                key={item.id}

                                className="mb-5"

                            >



                                <p className="font-bold">

                                    {item.origin}

                                    {" → "}

                                    {item.destination}

                                </p>





                                <div className="flex justify-between mt-3 text-xs">



                                    <span

                                        className={
                                            item.status !== "OPEN"
                                                ?
                                                "font-black text-orange-600"
                                                :
                                                "text-slate-400"
                                        }

                                    >

                                        MATCHED

                                    </span>






                                    <span

                                        className={
                                            [
                                                "DEPARTED",
                                                "ARRIVED",
                                                "COMPLETED"
                                            ].includes(item.status)
                                                ?
                                                "font-black text-orange-600"
                                                :
                                                "text-slate-400"
                                        }

                                    >

                                        ON WAY

                                    </span>






                                    <span

                                        className={
                                            item.status === "COMPLETED"
                                                ?
                                                "font-black text-green-600"
                                                :
                                                "text-slate-400"
                                        }

                                    >

                                        DONE

                                    </span>



                                </div>


                            </div>


                        ))

                    }


                </div>









                {/* HISTORY */}



                <div className="mt-8">


                    <h2 className="text-xl font-black mb-4">

                        Shipment History

                    </h2>





                    {
                        loadingShipments ?



                            (

                                <p>

                                    Loading...

                                </p>

                            )



                            :



                            shipments.length === 0 ?



                                (

                                    <div className="bg-white rounded-3xl p-6 text-center">

                                        No shipments yet.

                                    </div>

                                )



                                :



                                shipments.map(item => (


                                    <div

                                        key={item.id}

                                        className="bg-white rounded-3xl shadow p-5 mb-4"

                                    >


                                        <h3 className="font-black">

                                            {item.item_type}

                                        </h3>




                                        <p>

                                            📍 {item.origin}

                                        </p>



                                        <p>

                                            🏁 {item.destination}

                                        </p>




                                        <p className="font-bold">

                                            Status:

                                            {" "}

                                            {item.status}

                                        </p>

                                        <div className="mt-4 border-t pt-4">
                                            <h4 className="font-bold mb-2">Driver Bids</h4>

                                            {bids
                                                .filter((bid) => bid.shipment_id === item.id)
                                                .map((bid) => (
                                                    <div
                                                        key={bid.id}
                                                        className="border rounded-xl p-3 mb-2"
                                                    >
                                                        <p><strong>Driver:</strong> {bid.driver?.full_name}</p>
                                                        <p><strong>Offer:</strong> {bid.proposed_price} FCFA</p>
                                                        <p><strong>ETA:</strong> {bid.eta}</p>

                                                        {bid.note && (
                                                            <p><strong>Note:</strong> {bid.note}</p>
                                                        )}

                                                        <button
                                                            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                                                            onClick={() => acceptBid(bid)}
                                                        >
                                                            Accept Bid
                                                        </button>
                                                    </div>
                                                ))}

                                            {bids.filter((bid) => bid.shipment_id === item.id).length === 0 && (
                                                <p className="text-slate-500 text-sm">
                                                    No bids yet.
                                                </p>
                                            )}
                                        </div>



                                    </div>


                                ))

                    }


                </div>



                <DeleteAccount user={user} />

            </div>


        </div>


    );

}









function SummaryCard({ value, title }) {


    return (


        <div className="bg-white rounded-2xl p-4 text-center shadow">


            <p className="text-2xl font-black">

                {value}

            </p>




            <p className="text-xs text-slate-500">

                {title}

            </p>


        </div>


    );


}