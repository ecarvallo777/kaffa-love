import { Suspense } from "react";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Página TEMPORAL para comprobar la conexión con Supabase.
// Se reemplazará por el inicio real de la tienda.

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

async function Catalogo() {
  await connection(); // se lee en cada visita, no al compilar

  const { data, error } = await createPublicClient()
    .from("products")
    .select("id, name, type, price_clp, stock, track_stock")
    .order("type")
    .order("name");

  if (error) {
    return <p className="text-red-700">Error al conectar con Supabase: {error.message}</p>;
  }
  if (!data.length) {
    return <p>Conectado, pero no hay productos visibles. ¿Cargaste seed.sql?</p>;
  }

  return (
    <>
      <p className="text-green-700">Conexión correcta: {data.length} productos visibles online.</p>
      <ul className="mt-4 divide-y divide-stone-200">
        {data.map((p) => (
          <li key={p.id} className="flex justify-between gap-4 py-2">
            <span>
              {p.name} <span className="text-sm text-stone-500">({p.type})</span>
            </span>
            <span className="text-right">
              {clp.format(p.price_clp)}
              <span className="block text-sm text-stone-500">
                {p.track_stock ? `stock ${p.stock}` : "según componentes"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Kaffa Love · prueba de conexión</h1>
      <div className="mt-6">
        <Suspense fallback={<p>Conectando con Supabase…</p>}>
          <Catalogo />
        </Suspense>
      </div>
    </main>
  );
}
