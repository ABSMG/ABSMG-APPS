import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Storefront from "./store/Storefront.tsx";
import StoreAuth from "./store/StoreAuth.tsx";
import { storeSupabase } from "./lib/storeSupabase";
import "./index.css";

function StoreApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!storeSupabase) {
      setChecking(false);
      return;
    }

    storeSupabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session));
      setChecking(false);
    });

    const {
      data: { subscription },
    } = storeSupabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthenticated(Boolean(session));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading store...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <StoreAuth
        onAuthenticated={() => setAuthenticated(true)}
      />
    );
  }

  return <Storefront />;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found.");
}

const isStoreRoute =
  window.location.pathname.startsWith("/store");

createRoot(rootElement).render(
  <StrictMode>
    {isStoreRoute ? <StoreApp /> : <App />}
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
