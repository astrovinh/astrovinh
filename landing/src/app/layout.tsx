import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const openSans = localFont({
  src: [
    { path: "../../public/fonts/open-sans-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/open-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/open-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/open-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/open-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-opensans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevPet — Level up your vibe coding",
  description:
    "DevPet is an AI companion that tracks your coding sessions, teaches you best practices, and helps you go from first prompt to production — all guided by a pet mentor that learns alongside you.",
  openGraph: {
    title: "DevPet — Level up your vibe coding",
    description:
      "An AI coding pet that tracks your sessions, teaches best practices, and grows with you.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DevPet — Level up your vibe coding",
    description:
      "An AI coding pet that tracks your sessions, teaches best practices, and grows with you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={openSans.className}>
      <body className="antialiased">
        {children}

        {/* Plausible Analytics — update data-domain when domain is registered */}
        <Script
          defer
          data-domain="devpet.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
