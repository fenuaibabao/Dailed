import type { Metadata } from "next";
import { SessionWelcome } from "./SessionWelcome";

export const metadata: Metadata = { title: "Session" };

// Milestone 2 adds consent, the Quick/Deep buttons and the Vapi call here.
// Nothing on this page loads the Vapi SDK or asks for the microphone.
export default function SessionPage() {
  return <SessionWelcome />;
}
