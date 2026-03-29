import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const clearPreviewServiceWorkerCache = () => {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  const isLovablePreviewHost =
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.includes("lovable.dev");

  if (!isLovablePreviewHost || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key);
      });
    });
  }
};

clearPreviewServiceWorkerCache();

createRoot(document.getElementById("root")!).render(<App />);
