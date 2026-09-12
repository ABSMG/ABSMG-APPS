import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import Storefront from "./store/Storefront.tsx";
import StoreAuth from "./store/StoreAuth.tsx";
import "./index.css";

function StoreLogin() {
  return <StoreAuth />;
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element was not found.");
}

const path = window.location.pathname;

let page;

if (path === "/store/login") {
  page = <StoreLogin />;
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
