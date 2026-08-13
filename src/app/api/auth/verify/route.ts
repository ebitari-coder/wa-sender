import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyOtp } from "@/lib/email";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { isValidEmail } from "@/lib/numbers";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const token = String(body.token ?? "").trim();

    if (!isValidEmail(email) || !token) {
      return NextResponse.json({ error: "Email and access code are required." }, { status: 400 });
    }

    const userId = await verifyOtp(email, token);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired access code. Request a new one." },
        { status: 401 },
      );
    }

    const sessionToken = await createSession(userId);
    const store = await cookies();
    store.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/verify]", err);
    return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
  }
}
