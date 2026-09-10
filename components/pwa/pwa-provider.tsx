"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

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
  const [installed, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);

  useEffect(() => {
    function beforeInstall(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function appInstalled() {
      setPrompt(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);

    async function registerWorker() {
      if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      } catch {
        // Installation remains progressive: normal online use is still available.
        console.warn("WeBooks offline support could not be initialized.");
      }
    }
    void registerWorker();
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!prompt) return "unavailable";
    // A browser install event is single-use, including when the user dismisses it.
    const event = prompt;
    setPrompt(null);
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  }

  return (
    <PwaContext.Provider value={{ installed: installed || standalone, canPrompt: prompt !== null, install }}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used within PwaProvider");
  return context;
}
