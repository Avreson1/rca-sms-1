import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Royal Crown Academy | VCS Portal",
  description: "Virtual Classroom System for Royal Crown Academy, Rayfield, Jos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans" suppressHydrationWarning>{children}</body>
    </html>
  );
}
