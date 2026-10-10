import type { Metadata } from "next";
import { WorkspacesPanel } from "./WorkspacesPanel";

export const metadata: Metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return <WorkspacesPanel />;
}
