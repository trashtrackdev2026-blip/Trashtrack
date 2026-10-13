import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = localFont({
  src: "./fonts/Inter-Latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

const outfit = localFont({
  src: "./fonts/Outfit-Latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "TrashTrack Admin",
  description: "AI-Assisted Community Waste Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
