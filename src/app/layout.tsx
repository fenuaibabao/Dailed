import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { BRAND } from "@/config/brand";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body className="min-h-screen antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
