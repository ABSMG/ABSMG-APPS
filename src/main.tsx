import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Storefront from "./store/Storefront.tsx";
import StoreAuth from "./store/StoreAuth.tsx";
import StoreSetup from "./store/StoreSetup.tsx";
import StoreAdmin from "./store/StoreAdmin.tsx";
import "./index.css";


function StoreLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <h1 className="text-3xl font-bold text-slate-900">
        STORE LOGIN TEST
      </h1>
    </div>
  );
}

function StoreSetupPage() {
  return (
    <StoreSetup
      onComplete={() => {
        window.location.href = "/store";
      }}
    />
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found.");
}

const path = window.location.pathname;

let page;

if (path === "/store/login") {
  page = <StoreLogin />;
} else if (path === "/store/setup") {
  page = <StoreSetupPage />;
} else if (path === "/store/admin") {
  page = <StoreAdmin />;
} else if (path.startsWith("/store")) {
  page = <Storefront />;
} else {
  page = <App />;
}

createRoot(rootElement).render(
  <StrictMode>
    {page}
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.warn(
          "Service worker registration failed:",
          error
        );
      });
  });
}
