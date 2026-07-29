import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";


const ADMIN_PHONE = "681731512";


export default function AdminDashboard() {


    const router = useRouter();

    const { language, changeLanguage } = useLanguage();


    const [authorised, setAuthorised] = useState(false);

    const [pendingSubs, setPendingSubs] = useState([]);

    const [users, setUsers] = useState([]);

    const [shipments, setShipments] = useState([]);

    const [stats, setStats] = useState({
        users: 0,
        drivers: 0,
        shippers: 0,
        shipments: 0,
        pendingSubs: 0,
    });


    const [loading, setLoading] = useState(true);





    useEffect(() => {


        const saved = localStorage.getItem("tayebUser");


        if (!saved) {

            router.replace("/login");

            return;

        }



        const user = JSON.parse(saved);



        if (
            user.role !== "ADMIN" ||
            user.phone_number !== ADMIN_PHONE
        ) {

            router.replace("/");

            return;

        }



        setAuthorised(true);

        loadDashboard();


    }, []);








    async function loadDashboard() {


        setLoading(true);



        const [
            usersResponse,
            shipmentsResponse,
            subsResponse

        ] = await Promise.all([


            supabase
                .from("users")
                .select("*"),



            supabase
                .from("shipments")
                .select("*"),



            supabase
                .from("subscriptions")
                .select("*")
                .eq("status", "PENDING")

        ]);




        if (usersResponse.error) {

            alert(usersResponse.error.message);

        }


        if (shipmentsResponse.error) {

            alert(shipmentsResponse.error.message);

        }


        if (subsResponse.error) {

            alert(subsResponse.error.message);

        }




        const allUsers = usersResponse.data || [];

        const allShipments = shipmentsResponse.data || [];

        const pending = subsResponse.data || [];




        setUsers(allUsers);

        setShipments(allShipments);

        setPendingSubs(pending);





        setStats({

            users: allUsers.length,


            drivers: allUsers.filter(
                user => user.role === "DRIVER"
            ).length,


            shippers: allUsers.filter(
                user => user.role === "SHIPPER"
            ).length,


            shipments: allShipments.length,


            pendingSubs: pending.length,

        });



        setLoading(false);


    }









    async function handleApprove(subId, userId) {


        const expiry = new Date();


        expiry.setDate(
            expiry.getDate() + 32
        );



        const { error: subError } = await supabase
            .from("subscriptions")
            .update({

                status: "APPROVED"

            })
            .eq("id", subId);



        if (subError) {

            alert(subError.message);

            return;

        }





        const { error: userError } = await supabase
            .from("users")
            .update({

                subscription_expires_at:
                    expiry.toISOString(),

            })
            .eq("id", userId);




        if (userError) {

            alert(userError.message);

            return;

        }



        loadDashboard();


    }









    function logoutAdmin() {


        localStorage.removeItem(
            "tayebUser"
        );


        router.push("/login");


    }








    if (!authorised) return null;





    return (


        <div className="min-h-screen bg-slate-50 p-5">


            <main className="max-w-5xl mx-auto">







                {/* LANGUAGE */}

                <div className="flex justify-end mb-4">


                    <button

                        onClick={() => changeLanguage("en")}

                        className={`px-3 py-1 rounded-l-lg ${language === "en"
                            ? "bg-slate-900 text-white"
                            : "bg-white"
                            }`}

                    >

                        EN

                    </button>




                    <button

                        onClick={() => changeLanguage("fr")}

                        className={`px-3 py-1 rounded-r-lg ${language === "fr"
                            ? "bg-slate-900 text-white"
                            : "bg-white"
                            }`}

                    >

                        FR

                    </button>


                </div>









                {/* HEADER */}


                <div className="bg-white rounded-3xl shadow p-5 mb-8 flex justify-between items-center">


                    <div className="flex items-center gap-4">


                        <BrandLogo size="90" />


                        <div>


                            <h1 className="text-3xl font-black">

                                Tayeb Admin

                            </h1>


                            <p className="text-slate-500">

                                Platform Control Panel

                            </p>


                        </div>


                    </div>





                    <button

                        onClick={logoutAdmin}

                        className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"

                    >

                        Logout

                    </button>


                </div>








                {loading ? (


                    <div className="bg-white rounded-3xl p-8 text-center">

                        Loading Dashboard...

                    </div>


                ) : (



                    <>








                        {/* STATS */}


                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">


                            <StatCard
                                title="Users"
                                value={stats.users}
                            />


                            <StatCard
                                title="Drivers"
                                value={stats.drivers}
                            />


                            <StatCard
                                title="Shippers"
                                value={stats.shippers}
                            />


                            <StatCard
                                title="Shipments"
                                value={stats.shipments}
                            />


                            <StatCard
                                title="Pending"
                                value={stats.pendingSubs}
                            />


                        </div>









                        {/* SUBSCRIPTIONS */}


                        <section className="bg-white rounded-3xl p-6 mb-8">


                            <h2 className="text-xl font-black mb-4">

                                Pending Subscriptions

                            </h2>




                            {pendingSubs.length === 0 ? (


                                <p className="text-slate-500">

                                    No pending subscriptions.

                                </p>


                            ) : (


                                pendingSubs.map(sub => (


                                    <div
                                        key={sub.id}
                                        className="border rounded-2xl p-4 mb-3 flex justify-between items-center"
                                    >


                                        <div>


                                            <p className="font-bold">

                                                User ID: {sub.user_id}

                                            </p>


                                            <p className="text-sm text-slate-500">

                                                {sub.status}

                                            </p>


                                        </div>




                                        <button

                                            onClick={() =>
                                                handleApprove(
                                                    sub.id,
                                                    sub.user_id
                                                )
                                            }

                                            className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold"

                                        >

                                            Approve

                                        </button>


                                    </div>


                                ))


                            )}


                        </section>









                        {/* USERS */}


                        <section className="bg-white rounded-3xl p-6 mb-8">


                            <h2 className="text-xl font-black mb-4">

                                Users

                            </h2>




                            {users.map(user => (


                                <div
                                    key={user.id}
                                    className="border-b py-3"
                                >


                                    <p className="font-bold">

                                        {user.full_name}

                                    </p>


                                    <p className="text-sm text-slate-500">

                                        {user.phone_number} | {user.role}

                                    </p>


                                </div>


                            ))}


                        </section>









                        {/* SHIPMENTS */}


                        <section className="bg-white rounded-3xl p-6">


                            <h2 className="text-xl font-black mb-4">

                                Shipments

                            </h2>




                            {shipments.map(item => (


                                <div
                                    key={item.id}
                                    className="border rounded-2xl p-4 mb-3"
                                >


                                    <p className="font-black">

                                        {item.item_type}

                                    </p>


                                    <p>

                                        {item.origin} → {item.destination}

                                    </p>


                                    <p className="text-sm text-slate-500">

                                        Status: {item.status}

                                    </p>


                                </div>


                            ))}


                        </section>





                    </>

                )}




            </main>


        </div>


    );

}







function StatCard({ title, value }) {


    return (


        <div className="bg-white rounded-3xl p-5 shadow">


            <p className="text-3xl font-black">

                {value}

            </p>


            <p className="text-slate-500 text-sm">

                {title}

            </p>


        </div>


    );


}