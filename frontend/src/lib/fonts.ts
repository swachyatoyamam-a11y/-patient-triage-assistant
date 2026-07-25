import { Manrope, Inter, IBM_Plex_Mono } from "next/font/google";

// Display face — used with restraint (headings, hero copy only).
export const displayFont = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

// Body face — everything else the patient/clinician reads.
export const bodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

// Utility face — timestamps, IDs, vitals, anything numeric/tabular.
export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});
