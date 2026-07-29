import { useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";


export default function Notifications({ userId }) {


    const [notifications, setNotifications] = useState([]);

    const [loading, setLoading] = useState(true);




    useEffect(() => {

        if (!userId) return;

        fetchNotifications();


        const channel = supabase

            .channel("notifications")

            .on(

                "postgres_changes",

                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`
                },

                () => {

                    fetchNotifications();

                }

            )

            .subscribe();





        return () => {

            supabase.removeChannel(channel);

        };


    }, [userId]);







    async function fetchNotifications() {


        setLoading(true);



        const { data, error } = await supabase

            .from("notifications")

            .select("*")

            .eq("user_id", userId)

            .order("created_at", {
                ascending: false
            });




        if (!error) {

            setNotifications(data || []);

        }



        setLoading(false);


    }







    async function markRead(id) {


        await supabase

            .from("notifications")

            .update({
                read: true
            })

            .eq("id", id);



        fetchNotifications();


    }







    return (

        <div className="bg-white rounded-3xl shadow p-5 mb-6">


            <h2 className="font-black text-lg mb-4">

                🔔 Notifications

            </h2>





            {
                loading ?


                    <p>
                        Loading...
                    </p>



                    :



                    notifications.length === 0 ?


                        <p className="text-slate-500">

                            No notifications yet.

                        </p>



                        :



                        notifications.map(item => (


                            <div

                                key={item.id}

                                className={`border rounded-2xl p-4 mb-3 ${item.read
                                        ? "bg-white"
                                        : "bg-orange-50"
                                    }`}

                            >


                                <p className="font-bold">

                                    {item.title}

                                </p>


                                <p className="text-sm text-slate-600 mt-1">

                                    {item.message}

                                </p>




                                {
                                    !item.read &&

                                    <button

                                        onClick={() =>
                                            markRead(item.id)
                                        }

                                        className="mt-3 text-sm bg-slate-900 text-white px-3 py-2 rounded-xl"

                                    >

                                        Mark Read

                                    </button>

                                }


                            </div>


                        ))

            }


        </div>

    );

}