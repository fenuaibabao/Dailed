import type { Metadata } from "next";
import { enabledProductOrDefault } from "@/config/products";
import { SessionPanel } from "./SessionPanel";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const product = enabledProductOrDefault((await searchParams).product);
  return <SessionPanel product={{ slug: product.slug, name: product.name }} />;
}
