import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getPickupLocations } from "@/lib/pickup";
import { getCustomerProfile } from "@/lib/customer-auth";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
      <h1 className="font-display text-4xl font-light tracking-tight sm:text-5xl">Finalizar compra</h1>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-paper-2" />}>
        <Checkout />
      </Suspense>
    </div>
  );
}

async function Checkout() {
  await connection(); // datos del cliente con sesión: en cada visita
  const [catalog, settings, pickups, profile] = await Promise.all([
    getCatalog(),
    getSettings(),
    getPickupLocations(),
    getCustomerProfile(), // null si no hay sesión de cliente
  ]);
  return (
    <CheckoutForm
      catalog={catalog}
      pickups={pickups}
      rates={settings.shippingRates.filter((r) => r.enabled)}
      freeShippingFromClp={settings.freeShippingFromClp}
      profile={profile}
    />
  );
}
