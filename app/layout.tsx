import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas - Global Travel Route Dashboard",
  description: "Discover your next destination: flight times, estimated costs, seasonality, and deals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-surface text-gray-100 antialiased">{children}</body>
    </html>
  );
}
