import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export type PickupLocation = { id: string; name: string; address: string; hours: string };

/** Lugares de retiro activos (lectura pública) */
export async function getPickupLocations(): Promise<PickupLocation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("pickup");
  const { data, error } = await createPublicClient()
    .from("pickup_locations")
    .select("id, name, address, hours")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
