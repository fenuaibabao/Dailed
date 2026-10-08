import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { parseVapiWebhook } from "@/lib/vapi/endOfCallReport";
import { verifyVapiSecret } from "@/lib/vapi/webhookAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = verifyVapiSecret(request.headers, process.env.VAPI_WEBHOOK_SECRET);
  if (secret === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseVapiWebhook(body);
  if (parsed.kind === "invalid") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (parsed.kind === "other") {
    // Status updates, transcripts etc. aren't used yet.
    return NextResponse.json({ ok: true, ignored: parsed.type });
  }

  try {
    const result = await fetchMutation(api.vapiWebhook.recordEndOfCallReport, {
      secret,
      report: parsed.report,
    });
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    console.error("Vapi webhook: failed to record end-of-call report", error instanceof Error ? error.message : "");
    // 500 so Vapi retries; the mutation is idempotent.
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
