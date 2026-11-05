import { PageHeader } from "@/components/admin/ui";
import { PurchaseImport } from "./purchase-import";

export const metadata = { title: "Cargar compras" };

export default function PurchasesPage() {
  return (
    <>
      <PageHeader
        title="Cargar compras desde Excel"
        description="Suma stock de productos existentes o crea productos nuevos. Verás una vista previa antes de aplicar."
      />
      <PurchaseImport />
    </>
  );
}
