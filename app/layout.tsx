import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaProvider } from "../components/pwa/pwa-provider";
import "./globals.css";

const notoSansThai = localFont({
  src: [
    {
      path: "../public/fonts/NotoSansThai-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/NotoSansThai-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-webook-sans",
});

export const metadata: Metadata = {
  title: "Webook",
  description: "ระบบจัดการบ้านพักและใบเสนอราคา",
  applicationName: "Webook",
  appleWebApp: { capable: true, title: "Webook", statusBarStyle: "default" },
  icons: { apple: "/pwa/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#171717" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
