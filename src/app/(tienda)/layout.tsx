import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { ChristmasBar } from "@/components/christmas-bar";
import { SiteFooter } from "@/components/site-footer";
import { CartToast } from "@/components/cart-toast";
import { CartSync } from "@/components/cart-sync";
import { SourceCapture } from "@/components/source-capture";
import { getSettings } from "@/lib/settings";
import { MetaPixel } from "@/components/meta-pixel";
import { getStorePixelId } from "@/lib/marketing/meta-pixel";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChristmasBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartToast />
      <Suspense fallback={null}>
        <Welcome />
      </Suspense>
      {/* Leen la ruta actual: van en Suspense para no bloquear el prerenderizado */}
      <Suspense fallback={null}>
        <CartSync />
        {/* Visitas (Vercel Web Analytics): se activa en el panel de Vercel; en local no envía nada */}
        <Analytics />
        <Pixel />
      </Suspense>
    </>
  );
}

/** Canal de llegada y bienvenida del QR de feria (el % viene de Configuración) */
async function Welcome() {
  const { welcomePct } = await getSettings();
  return <SourceCapture welcomePct={welcomePct} />;
}

/** Píxel de Meta y aviso de cookies (solo si está conectado en Admin → Marketing) */
async function Pixel() {
  const pixelId = await getStorePixelId();
  return pixelId ? <MetaPixel pixelId={pixelId} /> : null;
}
