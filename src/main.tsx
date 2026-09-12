import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Storefront from "./store/Storefront.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found.");
}

const isStoreRoute = window.location.pathname.startsWith("/store");

createRoot(rootElement).render(
  <StrictMode>
    {isStoreRoute ? <Storefront /> : <App />}
  </StrictMode>
);

// Register service worker for PWA support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service worker registered.");
      })
      .catch((error) => {
        console.warn(
          "Service worker registration failed:",
          error
        );
      });
  });
}
