import type { Metadata } from "next";
import { DailySetupPanel } from "./DailySetupPanel";

export const metadata: Metadata = { title: "Daily setup" };

// Not linked from the app yet: Daily is in testing. Pilot families get the link.
export default function DailyPage() {
  return <DailySetupPanel />;
}
