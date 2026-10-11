import type { Metadata } from "next";
import { ConsentStep } from "@/components/auth/ConsentStep";
import { enabledProductOrDefault } from "@/config/products";

export const metadata: Metadata = { title: "Before your first session" };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const product = enabledProductOrDefault((await searchParams).product);
  return <ConsentStep product={{ slug: product.slug, recordingPurpose: product.recordingPurpose }} />;
}
