import { connection } from "next/server";
import { getInventorySheet } from "@/lib/inventory";
import { PageHeader } from "@/components/admin/ui";
import { CountSheet } from "./count-sheet";

export const metadata = { title: "Inventario" };

export default async function InventoryPage() {
  await connection();
  const rows = await getInventorySheet();
  return (
    <>
      <PageHeader
        title="Inventario"
        description="Cuenta lo que hay en la bodega y registra las diferencias, o suma la mercadería que llegó. Funciona bien desde el celular."
      />
      <CountSheet rows={rows} />
    </>
  );
}
