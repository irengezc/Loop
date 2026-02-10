import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-zinc-100 font-sans antialiased text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <div className="mx-auto min-h-screen max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
          {children}
        </div>
      </body>
    </html>
  );
}
