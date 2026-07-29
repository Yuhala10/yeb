import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import supabase from "../lib/supabaseClient";
import { useLanguage } from "../lib/LanguageContext";
import BrandLogo from "../components/BrandLogo";


const ADMIN_PHONE = "681731512";
const ADMIN_PIN = "03035 02027";


export default function LoginPage() {


    const router = useRouter();

    const { language, changeLanguage, t } = useLanguage();


    const [name, setName] = useState("");

    const [phone, setPhone] = useState("");

    const [role, setRole] = useState("SHIPPER");

    const [adminPin, setAdminPin] = useState("");

    const [loading, setLoading] = useState(false);





    useEffect(() => {

        const savedRole =
            localStorage.getItem("selectedRole");


        if (savedRole) {

            setRole(savedRole);

        }


    }, []);





    const cleanPhone = phone.trim();


    const isAdminPhone =
        cleanPhone === ADMIN_PHONE;







    async function handleLogin(e) {


        e.preventDefault();


        setLoading(true);




        // ADMIN LOGIN

        if (isAdminPhone) {


            if (adminPin !== ADMIN_PIN) {


                alert("Incorrect admin PIN.");

                setLoading(false);

                return;


            }




            const adminUser = {


                id: "admin",

                full_name:
                    "Platform Administrator",

                phone_number:
                    ADMIN_PHONE,

                role:
                    "ADMIN",

            };




            localStorage.setItem(

                "tayebUser",

                JSON.stringify(adminUser)

            );




            setLoading(false);


            router.push("/admin");


            return;


        }








        // NORMAL USER LOGIN



        const { data: existingUser, error: findError } = await supabase

            .from("users")

            .select("*")

            .eq("phone_number", cleanPhone)

            .maybeSingle();





        if (findError) {


            alert(findError.message);


            setLoading(false);


            return;


        }






        let user = existingUser;






        if (!user) {



            const { data: newUser, error } = await supabase

                .from("users")

                .insert([

                    {

                        full_name: name,

                        phone_number: cleanPhone,

                        role: role,

                    },

                ])

                .select()

                .single();






            if (error) {


                alert(error.message);


                setLoading(false);


                return;


            }



            user = newUser;



        }








        if (user.role !== role) {



            const { data: updatedUser, error } = await supabase

                .from("users")

                .update({

                    role: role,

                })

                .eq("id", user.id)

                .select()

                .single();






            if (!error && updatedUser) {


                user = updatedUser;


            }


        }








        localStorage.setItem(

            "tayebUser",

            JSON.stringify(user)

        );





        setLoading(false);






        if (user.role === "DRIVER") {


            router.push("/driver");


            return;


        }




        router.push("/shipper");



    }









    return (


        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">



            <form

                onSubmit={handleLogin}

                className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-md w-full space-y-5"

            >





                {/* BRAND */}



                <div className="text-center">


                    <div className="flex justify-center mb-3">


                        <BrandLogo size={150} />


                    </div>




                    <p className="text-orange-600 font-bold">

                        Move. Manage. Deliver.

                    </p>


                </div>









                {/* LANGUAGE */}



                <div className="flex justify-end">


                    <button

                        type="button"

                        onClick={() => changeLanguage("en")}

                        className={`px-3 py-1 rounded-l-lg text-sm ${language === "en"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200"
                            }`}

                    >

                        English

                    </button>





                    <button

                        type="button"

                        onClick={() => changeLanguage("fr")}

                        className={`px-3 py-1 rounded-r-lg text-sm ${language === "fr"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200"
                            }`}

                    >

                        Français

                    </button>



                </div>









                <div>


                    <h1 className="text-3xl font-black text-center">


                        {t.welcome}


                    </h1>



                    <p className="text-center text-slate-500 text-sm mt-2">


                        {t.loginCreate}


                    </p>


                </div>









                <input

                    type="text"

                    placeholder={t.fullName}

                    required={!isAdminPhone}

                    value={name}

                    onChange={(e) =>
                        setName(e.target.value)
                    }

                    disabled={isAdminPhone}

                    className="w-full border rounded-xl px-4 py-3 disabled:bg-gray-100"

                />







                <input

                    type="text"

                    placeholder={t.phone}

                    required

                    value={phone}

                    onChange={(e) =>
                        setPhone(e.target.value)
                    }

                    className="w-full border rounded-xl px-4 py-3"

                />







                {isAdminPhone && (


                    <input

                        type="password"

                        placeholder={t.adminPin}

                        required

                        value={adminPin}

                        onChange={(e) =>
                            setAdminPin(e.target.value)
                        }

                        className="w-full border rounded-xl px-4 py-3"

                    />


                )}









                {!isAdminPhone && (



                    <div className="grid grid-cols-2 gap-3">


                        <button

                            type="button"

                            onClick={() => {

                                setRole("SHIPPER");

                                localStorage.setItem(
                                    "selectedRole",
                                    "SHIPPER"
                                );

                            }}

                            className={`py-3 rounded-xl font-bold ${role === "SHIPPER"
                                ? "bg-orange-600 text-white"
                                : "bg-slate-200"
                                }`}

                        >

                            {t.shipper}

                        </button>







                        <button

                            type="button"

                            onClick={() => {

                                setRole("DRIVER");

                                localStorage.setItem(
                                    "selectedRole",
                                    "DRIVER"
                                );

                            }}

                            className={`py-3 rounded-xl font-bold ${role === "DRIVER"
                                ? "bg-orange-600 text-white"
                                : "bg-slate-200"
                                }`}

                        >

                            {t.driver}

                        </button>



                    </div>



                )}









                <button

                    type="submit"

                    disabled={loading}

                    className="w-full bg-slate-900 text-amber-400 py-4 rounded-2xl font-black hover:scale-[1.02] transition"

                >



                    {

                        loading

                            ? t.pleaseWait

                            : isAdminPhone

                                ? t.adminLogin

                                : t.continue

                    }



                </button>






            </form>



        </div>


    );


}