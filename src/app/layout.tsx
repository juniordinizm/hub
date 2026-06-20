import type { Metadata } from "next";
import { Geist_Mono, Lexend_Deca } from "next/font/google";
import { getServerEnv } from "@/lib/env";
import "./globals.css";

const lexendDeca = Lexend_Deca({
  variable: "--font-lexend-deca",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const env = getServerEnv();

export const metadata: Metadata = {
  title: {
    default: "PROTEA-R Hub",
    template: "%s | PROTEA-R Hub",
  },
  description: "Plataforma de cursos PROTEA-R para alunos e equipe.",
  applicationName: "PROTEA-R Hub",
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${lexendDeca.variable} ${geistMono.variable} h-full antialiased`}
      lang="pt-BR"
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
