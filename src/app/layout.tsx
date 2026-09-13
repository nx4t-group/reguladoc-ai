import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/providers/session-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RegulaDoc AI — Validação documental regulatória",
  description:
    "Apoio à decisão para conformidade documental de importações reguladas, com foco inicial em vinhos.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon.png?v=2", type: "image/png" },
      { url: "/icon.jpg?v=2", type: "image/jpeg" },
    ],
    apple: "/icon.png?v=2",
    shortcut: "/favicon.ico?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthSessionProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="top-right" />
          </TooltipProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
