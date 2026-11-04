import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Darsda",
  description: "Onlayn kurslar platformasi: darslar, vazifalar, ball va nazorat",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Darsda", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F4F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F1A" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Foydalanuvchi tanlagan mavzu (☀️/🌙); tanlanmagan bo'lsa — telefon sozlamasi
  const t = (await cookies()).get("theme")?.value;
  const theme = t === "light" || t === "dark" ? t : undefined;
  return (
    <html lang="uz" data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
