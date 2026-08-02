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
            <div className="fixed inset-0">
                <img
                    src="/branding/tayeb-splash.jpeg"
                    alt="Tayeb"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </div>
        );

    }
    return children;
}