"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { UpdateNotice } from "./update-notice";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaContextValue {
  installed: boolean;
  canPrompt: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaContext = createContext<PwaContextValue | null>(null);

function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const pendingInstall = useRef<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);

  useEffect(() => {
    let disposed = false;
    let currentRegistration: ServiceWorkerRegistration | undefined;
    const checkUpdate = () => {
      if (navigator.onLine && currentRegistration) void currentRegistration.update().catch(() => {});
    };
    function beforeInstall(event: Event) {
      if (!("prompt" in event) || typeof event.prompt !== "function" || !("userChoice" in event)) return;
      event.preventDefault();
      pendingInstall.current = event as InstallPromptEvent;
      setPrompt(event as InstallPromptEvent);
    }
    function appInstalled() {
      pendingInstall.current = null;
      setPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);

    async function registerWorker() {
      if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
      try {
        const registered = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        if (disposed) return;
        currentRegistration = registered;
        setRegistration(registered);
      } catch {
        // Installation remains progressive: normal online use is still available.
        console.warn("WeBooks offline support could not be initialized.");
      }
    }
    void registerWorker();
    window.addEventListener("focus", checkUpdate);
    window.addEventListener("online", checkUpdate);
    return () => {
      pendingInstall.current = null;
      disposed = true;
      window.removeEventListener("focus", checkUpdate);
      window.removeEventListener("online", checkUpdate);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    const event = pendingInstall.current;
    if (!event) return "unavailable";
    // A browser install event is single-use, including when the user dismisses it.
    pendingInstall.current = null;
    setPrompt(null);
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  }

  return (
    <PwaContext.Provider value={{ installed: installed || standalone, canPrompt: prompt !== null, install }}>
      {children}
      <UpdateNotice registration={registration} />
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used within PwaProvider");
  return context;
}
