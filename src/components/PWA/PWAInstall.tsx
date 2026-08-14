"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

const SNOOZE_KEY = "wa-pwa-install-dismissed";
const SNOOZE_DAYS = 7;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    const elapsed = Date.now() - dismissedAt;
    return elapsed < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch { /* noop */ }
}

function dismissPermanently() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
  } catch { /* noop */ }
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [installed, setInstalled] = useState(false);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setShowModal(false);
      dismissPermanently();
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    snooze();
  }, []);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (isDismissed()) return;

    setIsApple(isIOS());

    // Listen for beforeinstallprompt (Android/Chrome)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Show the modal after 3 seconds regardless of browser event
    // On Android: if beforeinstallprompt fires, Install button triggers native prompt
    // On Android (no event): shows manual instructions
    // On iOS: shows Share → Add to Home Screen instructions
    const timer = setTimeout(() => setShowModal(true), 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  if (installed) return null;

  return (
    <Modal open={showModal} onClose={handleDismiss} title="Install PCI Messenger" size="sm">
      <div className="px-5 pb-5">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <Icon name="download" className="h-8 w-8 text-accent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-stone-900">
              Add PCI Messenger to your home screen
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {isApple
                ? "Tap the Share button, then \"Add to Home Screen\" for quick access."
                : "Install the app for faster access, offline support, and a native experience."}
            </p>
          </div>

          {isApple ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </span>
                <span>Tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong></span>
              </div>
              <Button variant="outline" fullWidth onClick={handleDismiss}>
                Got it
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2">
              {deferredPrompt ? (
                <>
                  <Button variant="primary" fullWidth onClick={handleInstall}>
                    <Icon name="download" className="h-4 w-4" />
                    Install Now
                  </Button>
                  <Button variant="outline" fullWidth onClick={handleDismiss}>
                    Later
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-200">
                      <Icon name="download" className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p><strong>Chrome:</strong> Tap the ⋮ menu → <strong>Install app</strong></p>
                      <p><strong>Samsung Internet:</strong> Tap ≡ → <strong>Add page to</strong> → <strong>Home screen</strong></p>
                      <p><strong>Firefox:</strong> Tap ⋮ → <strong>Install</strong></p>
                    </div>
                  </div>
                  <Button variant="outline" fullWidth onClick={handleDismiss}>
                    Got it
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
