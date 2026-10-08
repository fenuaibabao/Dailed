import type { Metadata } from "next";
import { SessionPanel } from "./SessionPanel";

export const metadata: Metadata = { title: "Session" };

export default function SessionPage() {
  return <SessionPanel />;
}
