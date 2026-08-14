"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pwa-prompt-dismissed")) {
      setDismissed(true);
      return;
    }

    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));

    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    const timer = setTimeout(() => setShowPrompt(true), 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  }, []);

  if (isInstalled || !showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-lg">
              <Icon name="whatsapp" className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">Install PCI Messenger</p>
              <p className="text-xs text-stone-500">Get the native app experience</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>
            <span>Fast & works offline</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Home screen shortcut</span>
          </div>
        </div>

        {isIOS ? (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800 font-medium mb-1.5">How to install:</p>
            <ol className="text-xs text-amber-700 space-y-1">
              <li className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>Tap <strong>Share</strong> in Safari</span>
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                <span>Select <strong>Add to Home Screen</strong></span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={handleInstall}>
              <Icon name="download" className="h-3.5 w-3.5" />
              Install
            </Button>
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
