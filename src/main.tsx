import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLovablePreviewHost =
  host.endsWith(".lovable.app") ||
  host.endsWith(".lovableproject.com") ||
  host.includes("lovable.dev");

const shouldDisableSW = isInIframe || isLovablePreviewHost;

if (shouldDisableSW && typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
