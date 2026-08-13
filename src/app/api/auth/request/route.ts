import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/email";
import { isValidEmail } from "@/lib/numbers";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const result = await sendOtp(email);

    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      // Only exposed when no email provider is configured (local/dev usage),
      // so the user can still sign in without SMTP credentials.
      devOtp: result.otp,
    });
  } catch (err) {
    console.error("[auth/request]", err);
    return NextResponse.json({ error: "Could not send the access code." }, { status: 500 });
  }
}
