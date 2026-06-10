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
  title: {
    default: "PROTEA-R Hub",
    template: "%s | PROTEA-R Hub",
  },
  description: "Plataforma de cursos PROTEA-R para alunas e equipe.",
  applicationName: "PROTEA-R Hub",
  metadataBase: new URL("https://example.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="pt-BR"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
