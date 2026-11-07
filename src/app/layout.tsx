import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Royal Crown Academy | VCS Portal",
    template: "%s | Royal Crown Academy",
  },
  description: "Virtual Classroom System for Royal Crown Academy, Rayfield, Jos",
  applicationName: "RCA VCS Portal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1034a6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-canvas font-sans text-ink" suppressHydrationWarning>
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/plus-jakarta-sans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {children}
      </body>
    </html>
  );
}