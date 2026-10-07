import {
  StrictMode,
  lazy,
  Suspense,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "./index.css";


// =========================================================
// LAZY-LOADED MAIN NODYSOM AI APPLICATION
// =========================================================
//
// The main application is loaded only after the route has
// been checked.
//
// This helps reduce the amount of JavaScript required during
// the first startup of Nodysom AI.
//
// IMPORTANT:
// This does NOT remove App.tsx or any of its features.
// It only changes when App.tsx is downloaded and evaluated.
// =========================================================

const App = lazy(
  () =>
    import("./App.tsx")
);


// =========================================================
// LAZY-LOADED STORE COMPONENTS
// =========================================================
//
// These components are loaded only when the user actually
// visits a /store route. This keeps the main Nodysom AI
// application lighter and faster on first load.
//
// All existing Store routes remain available.
// =========================================================

const Storefront = lazy(
  () =>
    import("./store/Storefront.tsx")
);

const StoreAuth = lazy(
  () =>
    import("./store/StoreAuth.tsx")
);

const StoreSetup = lazy(
  () =>
    import("./store/StoreSetup.tsx")
);

const StoreAdmin = lazy(
  () =>
    import("./store/StoreAdmin.tsx")
);


// =========================================================
// STORE LOGIN
// =========================================================
//
// Keeps the existing StoreAuth component and route.
// No Store functionality is removed.
// =========================================================

function StoreLogin() {
  return (
    <StoreAuth />
  );
}


// =========================================================
// STORE SETUP
// =========================================================
//
// Keeps the existing StoreSetup flow.
// After setup completes, the user is redirected to /store.
// =========================================================

function StoreSetupPage() {
  return (
    <StoreSetup
      onComplete={() => {
        window.location.href =
          "/store";
      }}
    />
  );
}


// =========================================================
// ROOT ELEMENT
// =========================================================

const rootElement =
  document.getElementById(
    "root"
  );

if (!rootElement) {
  throw new Error(
    "Application root element was not found."
  );
}


// =========================================================
// ROUTE DETECTION
// =========================================================
//
// Route detection happens before rendering.
//
// This allows Nodysom AI to decide whether it needs the main
// application bundle or one of the Store bundles.
// =========================================================

const path =
  window.location.pathname;

let page;


// =========================================================
// STORE ROUTES
// =========================================================
//
// /store/login
// /store/setup
// /store/admin
// /store/*
//
// All existing Store routes are preserved.
// =========================================================

if (
  path ===
  "/store/login"
) {
  page =
    <StoreLogin />;

} else if (
  path ===
  "/store/setup"
) {
  page =
    <StoreSetupPage />;

} else if (
  path ===
  "/store/admin"
) {
  page =
    <StoreAdmin />;

} else if (
  path.startsWith(
    "/store"
  )
) {
  page =
    <Storefront />;

} else {

  // =======================================================
  // MAIN NODYSOM AI APPLICATION
  // =======================================================
  //
  // App itself is lazy-loaded.
  //
  // This prevents the browser from eagerly downloading
  // App.tsx and all of its dependencies before the route
  // decision is complete.
  // =======================================================

  page =
    <App />;
}


// =========================================================
// APPLICATION LOADING FALLBACK
// =========================================================
//
// This fallback is displayed while App.tsx or a Store
// component is being downloaded.
//
// It intentionally remains lightweight so that it appears
// quickly even on slower mobile connections.
// =========================================================

function LoadingScreen() {
  return (
    <div
      className="
        min-h-screen
        bg-slate-950
        text-slate-100
        flex
        items-center
        justify-center
      "
    >

      <div
        className="
          flex
          flex-col
          items-center
          gap-4
        "
      >

        {/* =================================================
            LOADING INDICATOR
            ================================================= */}

        <div
          className="
            h-10
            w-10
            rounded-full
            border-2
            border-slate-700
            border-t-blue-500
            animate-spin
          "
        />

        {/* =================================================
            APPLICATION NAME
            ================================================= */}

        <div
          className="
            text-sm
            text-slate-400
          "
        >
          Loading Nodysom AI…
        </div>

      </div>

    </div>
  );
}


// =========================================================
// RENDER APPLICATION
// =========================================================
//
// StrictMode remains enabled.
//
// Suspense handles both:
// - Nodysom AI lazy loading
// - Store lazy loading
//
// No existing application feature is removed.
// =========================================================

createRoot(
  rootElement
).render(
  <StrictMode>

    <Suspense
      fallback={
        <LoadingScreen />
      }
    >

      {page}

    </Suspense>

  </StrictMode>
);


// =========================================================
// SERVICE WORKER
// =========================================================
//
// The Service Worker remains enabled.
//
// It is registered after the window finishes loading so it
// does not block the initial React application startup.
//
// The registration is intentionally kept outside React so
// it works for both the main application and Store routes.
// =========================================================

if (
  "serviceWorker" in
  navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "/sw.js"
        )
        .then(
          (registration) => {

            console.log(
              "Nodysom AI Service Worker registered:",
              registration.scope
            );

          }
        )
        .catch(
          (error) => {

            console.warn(
              "Service worker registration failed:",
              error
            );

          }
        );

    },
    {
      once: true,
    }
  );
}
