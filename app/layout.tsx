import type { Metadata, Viewport } from "next";
// Fonts ship with the site so every screen renders the board the same way.
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/bodoni-moda/latin-500.css";
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "MAZZARI No. 1 / Mazzagotte Instrument Company",
  description:
    "An electromechanical-inspired information board by Mazzagotte Instrument Company. Precision in every flip.",
  icons: { icon: "/mazzari-favicon.webp" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0e0f",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
