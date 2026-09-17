import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Inter for reading text: large x-height, open counters, tabular figures.
const inter = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

// II Balfron for the display sizes: the countdown, watts, labels, titles.
// Its digits are proportional, so the timer renders each digit in a fixed cell.
const balfron = localFont({ src: "../fonts/ii-balfron.woff", variable: "--font-display", display: "swap", weight: "400" });

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
    <html lang="en" className={`${inter.variable} ${balfron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
