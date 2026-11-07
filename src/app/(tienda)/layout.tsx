import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartToast } from "@/components/cart-toast";
import { CartSync } from "@/components/cart-sync";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartToast />
      {/* Lee la ruta actual: va en Suspense para no bloquear el prerenderizado */}
      <Suspense fallback={null}>
        <CartSync />
      </Suspense>
    </>
  );
}
