import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Language Loop",
  description: "Write, get feedback, rewrite, practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200`}
      >
        <div className="mx-auto min-h-screen max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
          {children}
        </div>
      </body>
    </html>
  );
}
