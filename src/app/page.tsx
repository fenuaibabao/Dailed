import Link from "next/link";
import { APPS, BRAND } from "@/config/brand";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/lib/routes";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-accent">{APPS.create.name}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{BRAND.name}</h1>
      <p className="mt-4 text-lg text-muted">{BRAND.tagline}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={SIGN_UP_PATH}
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground"
        >
          Create an account
        </Link>
        <Link href={SIGN_IN_PATH} className="rounded-md border border-border px-4 py-2 font-medium">
          Sign in
        </Link>
      </div>
    </main>
  );
}
