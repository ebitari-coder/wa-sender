"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { ToastHost, useToast } from "@/components/ui/Toast";

type Step = "email" | "token";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast("Enter a valid email address.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not send the code.", "error");
        return;
      }
      if (data.delivered) {
        toast("Access code sent to your email.", "success");
      } else {
        setDevOtp(data.devOtp);
      }
      setStep("token");
      startResendTimer();
    } catch {
      toast("Network error. Try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  function startResendTimer() {
    setResendIn(30);
    const iv = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearInterval(iv);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      toast("Enter the access code from your email.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Invalid code.", "error");
        return;
      }
      toast("Welcome back!", "success");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast("Network error. Try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <ToastHost />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/30">
            <Icon name="whatsapp" className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-deep">PCI Messenger</h1>
          <p className="mt-1 text-sm text-stone-500">
            Power City Oke Ira Campus · Bulk messaging tool
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
          {step === "email" ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Sign in</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Enter your email and we&apos;ll send you an access code.
                </p>
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@church.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                Send access code
              </Button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setDevOtp(null);
                    setToken("");
                  }}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Icon name="chevron" className="h-3.5 w-3.5 rotate-90" />
                  Change email
                </button>
                <h2 className="text-base font-semibold text-stone-900">Enter access code</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  We sent a 6-digit code to <b>{email}</b>.
                </p>
              </div>

              {devOtp && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <p className="font-semibold">No email service configured (local mode)</p>
                  <p className="mt-1">
                    Your code is <span className="font-mono text-base font-bold">{devOtp}</span>.
                    Configure SMTP or Resend in <code className="font-mono">.env</code> to deliver by
                    email.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="token">Access code</Label>
                <Input
                  id="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  className="text-center text-lg font-bold tracking-[0.5em]"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>

              <Button type="submit" fullWidth loading={loading}>
                Verify &amp; continue
              </Button>

              <button
                type="button"
                disabled={resendIn > 0}
                onClick={() => void requestCode()}
                className="w-full text-center text-xs font-medium text-accent disabled:text-stone-400 hover:underline"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          For ministry administrators of Power City Oke Ira Campus.
        </p>
      </div>
    </main>
  );
}
