import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The browser-safe Vapi key, and nothing else, for signed-in users. */
export async function GET() {
  if (!(await isAuthenticatedNextjs())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const publicKey = process.env.VAPI_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: "voice is not configured" }, { status: 503 });
  }
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}
