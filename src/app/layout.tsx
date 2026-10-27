import type { Metadata, Viewport } from "next";
import { Inter, League_Gothic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Inter for reading text: large x-height, open counters, tabular figures.
const inter = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

// Display sizes (countdown, watts, labels, titles) use II Balfron, a licensed
// face kept out of the public repo and served from /fonts/display (see
// globals.css). League Gothic is the open fallback when it isn't available.
const leagueGothic = League_Gothic({ subsets: ["latin"], variable: "--font-display-fallback", display: "swap" });

export const metadata: Metadata = {
  title: "Pain Cave Timer",
  description: "Glanceable interval timer for coached indoor cycling workouts",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pain Cave" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${leagueGothic.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
