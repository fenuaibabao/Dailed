import type { Metadata } from "next";
import { PrivacyPanel } from "./PrivacyPanel";

export const metadata: Metadata = { title: "Your data" };

export default function PrivacyPage() {
  return <PrivacyPanel />;
}
