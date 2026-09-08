import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StagingBanner } from "@/components/environment/staging-banner";
import { PLATFORM_BRAND, PLATFORM_NAME } from "@/lib/brand";
import { getPublicAppUrl } from "@/lib/public-app-config";
import { getStagingPresentation } from "@/lib/staging-presentation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const publicAppUrl = getPublicAppUrl(process.env);
const stagingPresentation = getStagingPresentation(process.env);

export const metadata: Metadata = {
  title: {
    default: PLATFORM_NAME,
    template: `%s | ${PLATFORM_NAME}`,
  },
  description: `Plataforma de cursos da ${PLATFORM_BRAND} para Alunas e equipe.`,
  applicationName: PLATFORM_NAME,
  metadataBase: new URL(publicAppUrl),
  ...(stagingPresentation.robots ? { robots: stagingPresentation.robots } : {}),
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "oklch(0.237 0.025 204.4)",
};

import { Toaster } from "@/components/ui/sonner";

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
      <body className="flex min-h-full flex-col">
        {stagingPresentation.isStaging ? <StagingBanner /> : null}
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
