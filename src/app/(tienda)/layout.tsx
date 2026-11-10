import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartToast } from "@/components/cart-toast";
import { CartSync } from "@/components/cart-sync";
import { SourceCapture } from "@/components/source-capture";
import { getSettings } from "@/lib/settings";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
      </Suspense>
    </>
  );
}

/** Canal de llegada y bienvenida del QR de feria (el % viene de Configuración) */
async function Welcome() {
  const { welcomePct } = await getSettings();
  return <SourceCapture welcomePct={welcomePct} />;
}
