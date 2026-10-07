const CACHE_NAME = "nodysom-ai-v2";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL);
      })
      .catch((error) => {
        console.warn(
          "Nodysom AI cache install failed:",
          error
        );
      })
  );

  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Do not intercept external requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API requests.
  // This protects dynamic AI, authentication,
  // cloud data, and other backend responses.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Handle navigation requests separately.
  // Always try the latest version from the network first.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) => {
                return cache.put(request, responseClone);
              })
              .catch(() => {});
          }

          return response;
        })
        .catch(async () => {
          const cachedResponse =
            await caches.match(request);

          if (cachedResponse) {
            return cachedResponse;
          }

          const cachedHome =
            await caches.match("/");

          if (cachedHome) {
            return cachedHome;
          }

          return new Response(
            "Nodysom AI is currently offline.",
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }

  // Static assets use cache-first.
  // This makes repeat visits faster while still
  // updating the cache in the background.
  event.respondWith(
    caches
      .match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          event.waitUntil(
            fetch(request)
              .then((response) => {
                if (
                  response &&
                  response.ok
                ) {
                  return caches
                    .open(CACHE_NAME)
                    .then((cache) => {
                      return cache.put(
                        request,
                        response.clone()
                      );
                    });
                }

                return null;
              })
              .catch(() => {})
          );

          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            if (
              response &&
              response.ok
            ) {
              const responseClone =
                response.clone();

              caches
                .open(CACHE_NAME)
                .then((cache) => {
                  return cache.put(
                    request,
                    responseClone
                  );
                })
                .catch(() => {});
            }

            return response;
          })
          .catch(async () => {
            const cachedResponse =
              await caches.match(request);

            if (cachedResponse) {
              return cachedResponse;
            }

            return new Response(
              "Nodysom AI resource is unavailable offline.",
              {
                status: 503,
                headers: {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              }
            );
          });
      })
  );
});
