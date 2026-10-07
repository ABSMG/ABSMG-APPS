import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// =========================================================
// LAZY-LOADED STORE COMPONENTS
// =========================================================
// These components are loaded only when the user actually
// visits a /store route. This keeps the main Nodysom AI
// application lighter and faster on first load.

const Storefront = lazy(
  () => import("./store/Storefront.tsx")
);

const StoreAuth = lazy(
  () => import("./store/StoreAuth.tsx")
);

const StoreSetup = lazy(
  () => import("./store/StoreSetup.tsx")
);

const StoreAdmin = lazy(
  () => import("./store/StoreAdmin.tsx")
);


// =========================================================
// STORE LOGIN
// =========================================================

function StoreLogin() {
  return <StoreAuth />;
}


// =========================================================
// STORE SETUP
// =========================================================

function StoreSetupPage() {
  return (
    <StoreSetup
      onComplete={() => {
        window.location.href = "/store";
      }}
    />
  );
}


// =========================================================
// ROOT ELEMENT
// =========================================================

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Application root element was not found."
  );
}


// =========================================================
// ROUTE DETECTION
// =========================================================

const path =
  window.location.pathname;

let page;


// =========================================================
// STORE ROUTES
// =========================================================

if (
  path === "/store/login"
) {
  page = <StoreLogin />;

} else if (
  path === "/store/setup"
) {
  page = <StoreSetupPage />;

} else if (
  path === "/store/admin"
) {
  page = <StoreAdmin />;

} else if (
  path.startsWith("/store")
) {
  page = <Storefront />;

} else {

  // =======================================================
  // MAIN NODYSOM AI APPLICATION
  // =======================================================

  page = <App />;
}


// =========================================================
// APPLICATION LOADING FALLBACK
// =========================================================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">

        <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />

        <div className="text-sm text-slate-400">
          Loading Nodysom AI…
        </div>

      </div>
    </div>
  );
}


// =========================================================
// RENDER APPLICATION
// =========================================================

createRoot(rootElement).render(
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

if (
  "serviceWorker" in navigator
) {
  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {

          console.warn(
            "Service worker registration failed:",
            error
          );

        });

    }
  );
}
