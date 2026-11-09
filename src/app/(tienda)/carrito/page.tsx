import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Tu carrito", robots: { index: false } };

export default async function CartPage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="font-display text-4xl font-light tracking-tight sm:text-5xl">Tu carrito</h1>
      <CartView catalog={catalog} freeShippingFromClp={settings.freeShippingFromClp} />
    </div>
  );
}
