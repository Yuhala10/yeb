import { useEffect } from "react";

export default function ServiceWorkerRegistration() {

    useEffect(() => {

        if (
            typeof window === "undefined" ||
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        const registerServiceWorker = async () => {

            try {

                await navigator.serviceWorker.register(
                    "/sw.js",
                    {
                        scope: "/"
                    }
                );

                console.log(
                    "Tayeb service worker registered."
                );

            } catch (error) {

                console.error(
                    "Tayeb service worker registration failed:",
                    error
                );

            }

        };

        registerServiceWorker();

    }, []);

    return null;
}