"use server";

import { redirect } from "next/navigation";
import { startPayment } from "@/lib/payments";

export async function retryPayment(orderId: string) {
  const res = await startPayment(orderId);
  if (res.ok) redirect(res.url);
  return res.error;
}
