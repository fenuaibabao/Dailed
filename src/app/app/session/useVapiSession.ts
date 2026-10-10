"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type VapiType from "@vapi-ai/web";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { startSession, type ActionErrorCode } from "./actions";

type VapiInstance = InstanceType<typeof VapiType>;
type VapiOverrides = Parameters<VapiInstance["start"]>[1];

const START_ERRORS: Record<ActionErrorCode | "VOICE_UNAVAILABLE" | "MIC_OR_CONNECTION", string> = {
  UNAUTHENTICATED: "Your sign-in expired. Please sign in again.",
  RECORDING_CONSENT_REQUIRED: "Please agree to recording before starting a session.",
  APP_NOT_SEEDED: "Sessions aren't set up on this server yet (the seed hasn't run).",
  PRODUCT_UNAVAILABLE: "This product isn't available yet.",
  VOICE_UNAVAILABLE: "Voice sessions aren't available right now. Please try again later.",
  MIC_OR_CONNECTION:
    "We couldn't start the call. Check that your browser can use the microphone, then try again.",
  UNKNOWN: "Something went wrong starting the session. Please try again.",
};

/**
 * Starts and ends Vapi web calls. The SDK is imported, and the microphone
 * requested, only inside begin(), i.e. after the user clicks Start.
 */
export function useVapiSession() {
  const report = useMutation(api.calls.reportClientStatus);
  const vapiRef = useRef<VapiInstance | null>(null);
  const [activeCallId, setActiveCallId] = useState<Id<"calls"> | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void vapiRef.current?.stop();
    };
  }, []);

  const begin = useCallback(
    async (product: string, focus: string) => {
      if (starting || vapiRef.current !== null) return;
      setStarting(true);
      setError(null);
      let callId: Id<"calls"> | null = null;
      try {
        const started = await startSession({ product, focus: focus.trim() || undefined });
        if (!started.ok) {
          setError(START_ERRORS[started.error]);
          return;
        }
        callId = started.callId;
        setActiveCallId(callId);
        await report({ callId, status: "connecting" });

        const configResponse = await fetch("/api/vapi/public-config", { cache: "no-store" });
        if (!configResponse.ok) {
          await report({ callId, status: "failed", errorMessage: "voice-unavailable" });
          setError(START_ERRORS.VOICE_UNAVAILABLE);
          return;
        }
        const { publicKey } = (await configResponse.json()) as { publicKey: string };

        const { default: Vapi } = await import("@vapi-ai/web");
        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;
        const id = callId;
        vapi.on("call-start", () => {
          void report({ callId: id, status: "in_session" });
        });
        vapi.on("call-end", () => {
          void report({ callId: id, status: "processing" });
          vapiRef.current = null;
        });

        // Our overrides are built server side and match Vapi's shape; the SDK
        // types narrow model names to a literal union, hence the cast.
        const call = await vapi.start(
          started.assistantId,
          started.assistantOverrides as unknown as VapiOverrides,
        );
        if (call === null) throw new Error("vapi-start-returned-null");
        await report({ callId, status: "connecting", vapiCallId: call.id });
      } catch {
        vapiRef.current = null;
        if (callId !== null) {
          await report({ callId, status: "failed", errorMessage: "client-start-failed" }).catch(() => {});
        }
        setError(START_ERRORS.MIC_OR_CONNECTION);
      } finally {
        setStarting(false);
      }
    },
    [report, starting],
  );

  const end = useCallback(async () => {
    await vapiRef.current?.stop();
  }, []);

  return { begin, end, activeCallId, setActiveCallId, starting, error };
}
