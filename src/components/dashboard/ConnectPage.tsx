"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

interface WaStatus {
  mode: string;
  realMode: boolean;
  available: boolean;
  packageInstalled: boolean;
  state: string;
  reason: string;
  readyInfo: { number?: string; name?: string } | null;
  qr: string | null;
  pairingCode: string | null;
}

const states: Record<string, { label: string; icon: "phone" | "send" | "check" | "x"; cls: string }> = {
  unavailable: { label: "Not available", icon: "phone", cls: "bg-stone-100 text-stone-500" },
  disconnected: { label: "Disconnected", icon: "phone", cls: "bg-amber-50 text-amber-700" },
  connecting: { label: "Connecting", icon: "send", cls: "bg-sky-50 text-sky-700" },
  qr: { label: "Scan to connect", icon: "phone", cls: "bg-accent/10 text-accent" },
  ready: { label: "Connected", icon: "check", cls: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Connection failed", icon: "x", cls: "bg-red-50 text-red-700" },
};

function QR({ value }: { value: string }) {
  // The server now always sends a data URL, so we can render it directly
  if (!value || value === "waiting") {
    return (
      <div className="flex h-72 w-72 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-accent" />
      </div>
    );
  }
  return <img src={value} alt="WhatsApp QR code" className="h-72 w-72 rounded-2xl" />;
}

export default function ConnectPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connect/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        // If there's a persisted session and we're not connected, trigger connect
        if (data.hasPersistedSession && data.state !== "ready" && data.state !== "connecting" && data.state !== "qr") {
          fetch("/api/connect", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/connect/qr");
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      setStatus((prev) => ({ ...(prev ?? { mode: "webjs", available: true, packageInstalled: true }), ...data }));
      setQr(data.qr ?? null);
    };
    return () => es.close();
  }, []);

  const st = status;
  const ready = st?.state === "ready";
  const meta = states[st?.state ?? "unavailable"] ?? states.unavailable;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-deep">Connect WhatsApp</h1>
        <p className="text-sm text-stone-500">
          Link a WhatsApp account to send messages through.
        </p>
      </div>

      {st && (
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.cls}`}>
                  <Icon name={meta.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-stone-800">{meta.label}</span>
              </span>
            }
            subtitle="WhatsApp Web connection"
          />
          <CardBody className="space-y-4">
            {!st.packageInstalled ? (
              <div className="space-y-3 text-sm text-stone-600">
                <p>
                  Sending needs the <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">whatsapp-web.js</code>{" "}
                  package installed:
                </p>
                <pre className="overflow-x-auto rounded-xl bg-stone-900 p-4 font-mono text-xs text-emerald-300">
                  {`npm install whatsapp-web.js\n# then restart the server`}
                </pre>
                <p className="text-xs text-stone-400">
                  A Chromium browser is downloaded automatically on first connect. This works best on
                  a desktop/laptop where you can scan the QR code.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ready && st.readyInfo ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Icon name="whatsapp" className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {st.readyInfo.name || "Connected"}
                      </p>
                      <p className="font-mono text-xs text-emerald-600">+{st.readyInfo.number}</p>
                    </div>
                  </div>
                ) : st.state === "failed" || st.state === "disconnected" ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 ring-1 ring-red-100">
                      <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{st.reason || "WhatsApp is not connected."}</span>
                    </div>
                    <Button variant="primary" fullWidth onClick={() => window.location.reload()}>
                      <Icon name="retry" className="h-4 w-4" />
                      Retry connection
                    </Button>
                  </div>
                ) : (
                  <>
                    {st.state === "unavailable" && (
                      <p className="text-xs text-stone-500">Starting WhatsApp connection…</p>
                    )}

                    {/* Desktop: QR Code */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Option 1: Scan QR Code (Desktop)</p>
                      <p className="text-xs text-stone-500">
                        Open <b>WhatsApp → Settings → Linked devices</b> on your phone, tap{" "}
                        <b>&quot;Link a device&quot;</b>, then scan this QR code.
                      </p>
                      <div className="flex justify-center">
                        <QR value={qr ?? "waiting"} />
                      </div>
                      {qr && (
                        <p className="text-center text-[11px] text-stone-400">
                          Keep this tab open while you scan.
                        </p>
                      )}
                    </div>

                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-stone-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-3 text-stone-400">or</span>
                      </div>
                    </div>

                    {/* Mobile: Pairing Code */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-stone-700">Option 2: Pairing Code (Mobile)</p>
                      <p className="text-xs text-stone-500">
                        If you&apos;re on the same phone, use this code instead:
                      </p>
                      {st.pairingCode ? (
                        <div className="flex justify-center">
                          <div className="rounded-xl border-2 border-dashed border-accent bg-accent/5 px-6 py-4">
                            <p className="text-center font-mono text-2xl font-bold tracking-[0.3em] text-accent">
                              {st.pairingCode}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-accent" />
                        </div>
                      )}
                      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-[11px] text-amber-700 ring-1 ring-amber-100">
                        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          On your phone, go to <b>WhatsApp → Settings → Linked devices → Link a device</b>,
                          then tap <b>&quot;Link with phone number&quot;</b> and enter the code above.
                        </span>
                      </div>
                    </div>

                    {/* WhatsApp Deep Link */}
                    <a
                      href="https://wa.me/linkdevice"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <Icon name="whatsapp" className="h-5 w-5" />
                      Open WhatsApp Linked Devices
                    </a>
                  </>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="How sending works" subtitle="A quick guide for administrators" />
        <CardBody className="space-y-3 text-xs text-stone-600">
          <div className="flex gap-2">
            <b className="text-accent">1.</b>
            <span>Link WhatsApp once by scanning the QR code above.</span>
          </div>
          <div className="flex gap-2">
            <b className="text-accent">2.</b>
            <span>
              Create a campaign with the recipients&apos; numbers and your message. Use the schedule
              option to send at service time automatically.
            </span>
          </div>
          <div className="flex gap-2">
            <b className="text-accent">3.</b>
            <span>
              Watch progress live. Each message is spaced randomly within your chosen interval to
              protect the account.
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
