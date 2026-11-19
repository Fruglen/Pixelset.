"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Add to Home Screen: registers the app service worker (Phase 5B), then uses
// the browser's native install prompt when it offers one, otherwise shows the
// right manual steps for the platform.
export default function InstallPrompt({ appName = "this gallery" }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [sw, setSw] = useState<"pending" | "ready" | "unsupported" | "failed">("pending");

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true
    );
    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "desktop");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/app-sw.js", { scope: "/app/" })
        .then(() => setSw("ready"))
        .catch(() => setSw("failed"));
    } else setSw("unsupported");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) {
    return <p className="text-center text-xs text-white/40">✓ Installed, you&rsquo;re viewing the app.</p>;
  }
  if (installed) {
    return <p className="text-center text-xs text-white/60">✓ Added to your home screen.</p>;
  }

  async function install() {
    if (!deferred) return setShowHint((v) => !v);
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <div>
      {deferred && (
        <div className="mb-3 rounded-xl bg-white/10 p-3 text-sm flex items-center gap-3">
          <span className="flex-1">Install {appName} on this device for one tap access.</span>
          <button onClick={install} className="rounded-full bg-white text-neutral-900 px-4 py-1.5 text-xs font-medium">
            Install
          </button>
        </div>
      )}
      <button
        onClick={install}
        className="w-full text-center rounded-full py-3 text-sm border border-white/25 hover:bg-white/10"
      >
        ⊕ Add to Home Screen
      </button>
      {showHint && !deferred && (
        <div className="mt-3 text-xs text-white/60 bg-white/5 rounded-lg p-3 space-y-1">
          <p className="font-medium text-white/80">Install this gallery as an app:</p>
          {platform === "ios" && <p>Tap Share ▵ at the bottom of Safari, then &ldquo;Add to Home Screen&rdquo;.</p>}
          {platform === "android" && <p>Open the ⋮ menu in Chrome and choose &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>}
          {platform === "desktop" && <p>Use the install icon in the address bar, or open this link on your phone.</p>}
          {sw === "unsupported" && <p>This browser does not support app installs, the page still works as a bookmark.</p>}
        </div>
      )}
    </div>
  );
}
