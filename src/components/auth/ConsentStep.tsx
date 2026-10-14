"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ASSISTANT_NAME } from "@/config/brand";
import { api } from "../../../convex/_generated/api";
import { grantRecordingConsent } from "@/app/app/session/actions";
import { RECORDING_CONSENT_TEXT } from "@/lib/consent";
import { AFTER_AUTH_PATH, withProduct } from "@/lib/routes";

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true,
} as const;

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface-2">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/**
 * The one-time recording consent, shown after sign-up and before the first
 * session. Anyone who already agreed is sent straight on.
 */
export function ConsentStep({ product }: { product: { slug: string; recordingPurpose: string } }) {
  const router = useRouter();
  const next = withProduct(AFTER_AUTH_PATH, product.slug);
  const { isAuthenticated } = useConvexAuth();
  const consent = useQuery(api.consents.myRecordingConsent, isAuthenticated ? {} : "skip");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (consent) router.replace(next);
  }, [consent, next, router]);

  async function onContinue() {
    setSaving(true);
    setError(null);
    const result = await grantRecordingConsent();
    if (result.ok) {
      router.push(next);
      return;
    }
    setError("We couldn't save that. Please try again.");
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">One quick thing</p>
        <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Before your first session</h1>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-soft">
        <Point
          icon={
            <svg {...ICON_PROPS}>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          }
        >
          {ASSISTANT_NAME} is an AI interviewer, not a person.
        </Point>
        <Point
          icon={
            <svg {...ICON_PROPS}>
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          }
        >
          Sessions are recorded {product.recordingPurpose}.
        </Point>
        <Point
          icon={
            <svg {...ICON_PROPS}>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          }
        >
          Your sessions are private to you. You can delete any of them, any time.
        </Point>
      </ul>
      <label
        htmlFor="agree"
        className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 ${
          agreed ? "border-accent bg-accent-surface" : "border-border-strong bg-surface"
        }`}
      >
        <input
          id="agree"
          type="checkbox"
          checked={agreed}
          disabled={saving}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-[22px] w-[22px] flex-none cursor-pointer"
        />
        <span>{RECORDING_CONSENT_TEXT}</span>
      </label>
      <button
        type="button"
        disabled={!agreed || saving}
        onClick={onContinue}
        className="btn btn-primary min-h-[52px] w-full rounded-xl text-base"
      >
        {saving ? "Saving…" : "Continue"}
      </button>
      {!agreed && (
        <p className="m-0 text-center text-sm text-muted">Tick the box to continue. Sessions can&apos;t start without it.</p>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
