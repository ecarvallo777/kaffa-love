import { connection } from "next/server";
import { fairProducts, getOpenSession, sessionSummary } from "@/lib/fair";
import { listCategories } from "@/lib/admin-data";
import { OpenSessionForm } from "./open-session-form";
import { Pos } from "./pos";

export default async function FairPage() {
  await connection();
  const session = await getOpenSession();
  const { products, bundleItems } = await fairProducts();

  if (!session) {
    return <OpenSessionForm preparados={products.filter((p) => p.type === "preparado" && p.track_stock)} />;
  }

  const [summary, categories] = await Promise.all([sessionSummary(session.id), listCategories()]);
  return (
    <Pos
      session={{ id: session.id, name: session.name }}
      products={products}
      bundleItems={bundleItems}
      categories={categories}
      totals={{ count: summary.count, total: summary.total }}
      recent={summary.orders.slice(0, 5).map((o) => ({ id: o.id, number: o.number, total: o.total_clp, status: o.status, at: o.created_at }))}
    />
  );
}
