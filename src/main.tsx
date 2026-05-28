import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (typeof window !== "undefined" && window.location.hostname.endsWith(".lovable.app")) {
  try {
    void navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });

    void caches?.keys?.().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key);
      });
    });
  } catch {
    // Ignore preview-only cache clear failures.
  }
}

createRoot(document.getElementById("root")!).render(<App />);
