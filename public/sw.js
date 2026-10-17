// v2: drops caches from before API answers were excluded.
const CACHE_NAME = "tayeb-v2";

const APP_SHELL = [
    "/",
    "/login"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );

    self.skipWaiting();
});


self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        return cacheName !== CACHE_NAME;
                    })
                    .map((cacheName) => {
                        return caches.delete(cacheName);
                    })
            );
        })
    );

    self.clients.claim();
});


self.addEventListener("fetch", (event) => {

    if (event.request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // Never cache API answers: they hold personal data and
    // must not be shown to the next person using the phone.
    if (requestUrl.pathname.startsWith("/api/")) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {
                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(
                            event.request,
                            responseClone
                        );
                    });
                }

                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});