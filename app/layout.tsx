import type { Metadata } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Appetito — Your Family Cookbook",
  description: "Save, organise, and cook your favourite family recipes.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunito.variable}`}>
      <body className="antialiased">
        {/* Grain texture overlay */}
        <div className="grain" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
