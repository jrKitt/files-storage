import type { Metadata } from "next";
import { Athiti } from "next/font/google";
import "./globals.css";

const athiti = Athiti({
  variable: "--font-athiti",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "jrKitt Lab",
  description: "Storage lab dashboard with file upload, tagging, and Firebase status",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${athiti.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950">{children}</body>
    </html>
  );
}
