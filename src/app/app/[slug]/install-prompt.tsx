"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

// Add-to-home-screen: uses the native install prompt when the browser offers it,
// otherwise shows platform instructions.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone) {
    return <p className="text-center text-xs text-white/40">✓ Installed, you&rsquo;re viewing the app.</p>;
  }

  return (
    <div>
      <button
        onClick={() => {
          if (deferred) deferred.prompt();
          else setShowHint((v) => !v);
        }}
        className="w-full text-center rounded-full py-3 text-sm border border-white/25 hover:bg-white/10"
      >
        ⊕ Add to Home Screen
      </button>
      {showHint && !deferred && (
        <div className="mt-3 text-xs text-white/60 bg-white/5 rounded-lg p-3 space-y-1">
          <p className="font-medium text-white/80">Install this gallery as an app:</p>
          <p>iPhone / iPad: tap Share ▵ then “Add to Home Screen”.</p>
          <p>Android / Chrome: open the ⋮ menu and choose “Add to Home screen”.</p>
        </div>
      )}
    </div>
  );
}
