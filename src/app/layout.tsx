import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kaffa Love · Café de especialidad",
    template: "%s · Kaffa Love",
  },
  description:
    "Café de especialidad tostado en Chile, en bolsas de 250 g molidas a tu medida, y accesorios para prepararlo en casa.",
  openGraph: { type: "website", locale: "es_CL", siteName: "Kaffa Love" },
};

export const viewport: Viewport = { themeColor: "#1d1511" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
