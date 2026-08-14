"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { Input, Label } from "@/components/ui/Field";

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

type Tab = "qr" | "phone";

function QRImage({ value }: { value: string }) {
  if (!value || value === "waiting") {
    return (
      <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-accent" />
      </div>
    );
  }
  return <img src={value} alt="WhatsApp QR code" className="h-64 w-64 rounded-2xl" />;
}

export default function ConnectPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [phone, setPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/connect/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.hasPersistedSession && data.state !== "ready" && data.state !== "connecting" && data.state !== "qr") {
          fetch("/api/connect", { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/connect/qr");
    esRef.current = es;
    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      setStatus((prev) => ({ ...(prev ?? { mode: "baileys", available: true, packageInstalled: true }), ...data }));
      setQr(data.qr ?? null);
      if (data.pairingCode) {
        setGeneratedCode(data.pairingCode);
      }
      if (data.state === "ready" || data.state === "connecting") {
        setPairingError(null);
      }
    };
    return () => { es.close(); esRef.current = null; };
  }, []);

  const handleGeneratePairing = useCallback(async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) {
      setPairingError("Enter 6–15 digits in international format (country code + number).");
      return;
    }
    setPairingLoading(true);
    setPairingError(null);
    setGeneratedCode(null);
    try {
      const res = await fetch("/api/connect/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: digits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPairingError(data.error || "Failed to generate pairing code.");
      } else {
        setGeneratedCode(data.pairingCode);
      }
    } catch {
      setPairingError("Network error. Please try again.");
    } finally {
      setPairingLoading(false);
    }
  }, [phone]);

  const st = status;
  const ready = st?.state === "ready";
  const isQr = st?.state === "qr" || st?.state === "connecting" || st?.state === "unavailable";

  return (
    <div className="mx-auto max-w-lg space-y-6">
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
                {ready ? (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">Connected</span>
                  </>
                ) : st.state === "failed" ? (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700">
                      <Icon name="x" className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">Connection failed</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Icon name="phone" className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">
                      {st.state === "qr" ? "Scan to connect" : st.state === "connecting" ? "Connecting..." : "Disconnected"}
                    </span>
                  </>
                )}
              </span>
            }
            subtitle={ready && st.readyInfo ? `${st.readyInfo.name ?? "WhatsApp"} · +${st.readyInfo.number}` : "WhatsApp Web connection"}
            action={
              ready ? (
                <Button variant="ghost" size="sm" onClick={() => {}}>
                  <Icon name="whatsapp" className="h-4 w-4" />
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
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
                {/* Tabs */}
                <div className="flex rounded-xl border border-stone-200 bg-stone-50 p-1">
                  <button
                    onClick={() => setActiveTab("qr")}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                      activeTab === "qr"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    QR Code
                  </button>
                  <button
                    onClick={() => setActiveTab("phone")}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                      activeTab === "phone"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Link with Phone Number
                  </button>
                </div>

                {/* QR Code Tab */}
                {activeTab === "qr" && (
                  <div className="space-y-4">
                    <h2 className="text-base font-semibold text-stone-900">Scan QR Code</h2>
                    <div className="flex justify-center">
                      <QRImage value={qr ?? "waiting"} />
                    </div>
                    <ol className="space-y-2 text-sm text-stone-600">
                      <li className="flex gap-2">
                        <span className="font-semibold text-accent">1.</span>
                        Open WhatsApp on your phone
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-accent">2.</span>
                        Tap <b>Menu → Linked Devices</b>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-accent">3.</span>
                        Tap <b>Link a Device</b> and scan this QR
                      </li>
                    </ol>
                    {qr && (
                      <p className="text-center text-[11px] text-stone-400">
                        QR updates automatically every 5 seconds
                      </p>
                    )}
                  </div>
                )}

                {/* Phone Number Tab */}
                {activeTab === "phone" && (
                  <div className="space-y-4">
                    <h2 className="text-base font-semibold text-stone-900">Link with Phone Number</h2>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g., 2348012345678"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPairingError(null); }}
                        disabled={pairingLoading}
                      />
                      <p className="mt-1.5 text-xs text-stone-400">
                        Digits only (no +, spaces, or dashes) in international format (country code + number).
                      </p>
                    </div>

                    {pairingError && (
                      <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 ring-1 ring-red-100">
                        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{pairingError}</span>
                      </div>
                    )}

                    {generatedCode && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-stone-700">Your pairing code:</p>
                        <div className="flex justify-center">
                          <div className="rounded-xl border-2 border-dashed border-accent bg-accent/5 px-8 py-5">
                            <p className="text-center font-mono text-3xl font-bold tracking-[0.3em] text-accent">
                              {generatedCode}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500">
                          On your phone, go to <b>WhatsApp → Settings → Linked devices → Link a device</b>,
                          then tap <b>&quot;Link with phone number&quot;</b> and enter the code above.
                        </p>
                      </div>
                    )}

                    <Button
                      variant="primary"
                      fullWidth
                      size="lg"
                      loading={pairingLoading}
                      onClick={handleGeneratePairing}
                    >
                      Generate Pairing Code
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="How sending works" subtitle="A quick guide for administrators" />
        <CardBody className="space-y-3 text-xs text-stone-600">
          <div className="flex gap-2">
            <b className="text-accent">1.</b>
            <span>Link WhatsApp once by scanning the QR code or using phone number pairing.</span>
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
