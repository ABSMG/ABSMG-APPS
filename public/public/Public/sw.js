const CACHE_NAME = "nodysom-ai-v2";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((error) => {
        console.warn(
          "Nodysom AI service worker cache setup failed:",
          error
        );
      })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Never cache API responses.
   *
   * Nodysom AI responses must remain live because
   * they depend on Gemini/OpenRouter/Supabase.
   */
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) {
          return cached;
        }

        const fallback = await caches.match("/");

        return (
          fallback ||
          new Response(
            `
              <!doctype html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <title>Nodysom AI</title>
                  <meta name="viewport" content="width=device-width,initial-scale=1">
                </head>
                <body
                  style="
                    margin:0;
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#020617;
                    color:white;
                    font-family:system-ui,sans-serif;
                    text-align:center;
                    padding:24px;
                  "
                >
                  <div>
                    <h1>Nodysom AI</h1>
                    <p>You are currently offline.</p>
                    <p>Please reconnect to continue using AI features.</p>
                  </div>
                </body>
              </html>
            `,
            {
              status: 503,
              headers: {
                "Content-Type": "text/html; charset=utf-8"
              }
            }
          )
        );
      })
  );
});
