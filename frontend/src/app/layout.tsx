import type { Metadata } from "next";
import { displayFont, bodyFont, monoFont } from "@/lib/fonts";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ToastProvider } from "@/components/shared/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intelligent Patient Triage Assistant",
  description:
    "AI-assisted, clinician-reviewed triage that routes patients to the right level of care faster.",
};

// Note: ClerkProvider is intentionally NOT wrapping the app yet. It throws
// at runtime without a real NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, which this
// environment doesn't have. Auth currently runs on the backend's own JWT
// (see lib/api-client.ts + middleware.ts) — re-add <ClerkProvider> here
// once real Clerk keys exist, and retire the interim JWT-cookie approach.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
