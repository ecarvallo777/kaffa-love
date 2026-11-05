import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getPickupLocations } from "@/lib/pickup";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  const [catalog, settings, pickups] = await Promise.all([
    getCatalog(),
    getSettings(),
    getPickupLocations(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="font-display text-4xl font-light tracking-tight sm:text-5xl">Finalizar compra</h1>
      <CheckoutForm
        catalog={catalog}
        pickups={pickups}
        rates={settings.shippingRates.filter((r) => r.enabled)}
        freeShippingFromClp={settings.freeShippingFromClp}
      />
    </div>
  );
}
