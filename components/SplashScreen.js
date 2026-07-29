import { useEffect, useState } from "react";

export default function SplashScreen({ children }) {

    const [showSplash, setShowSplash] = useState(true);


    useEffect(() => {

        const timer = setTimeout(() => {

            setShowSplash(false);

        }, 2000);


        return () => clearTimeout(timer);

    }, []);



    if (showSplash) {

        return (

            <div className="min-h-screen bg-slate-900 flex items-center justify-center">

                <img
                    src="/branding/tayeb-splash.jpeg"
                    alt="Tayeb"
                    className="w-64 h-auto object-contain"
                />

            </div>

        );

    }



    return children;

}