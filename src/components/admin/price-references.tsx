/** Referencias de precio del estudio de mercado: tienda, producto, precio y enlace */
export function PriceReferences({ references }: { references: { store: string; title: string; url: string; priceClp: number; match: "igual" | "similar" }[] }) {
  if (!references.length) return <p className="mt-2 text-xs text-ink-mute">Sin referencias encontradas.</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {[...references]
        .sort((a, b) => a.priceClp - b.priceClp)
        .map((r) => (
          <li key={r.url} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-20 shrink-0 font-medium tabular-nums">${r.priceClp.toLocaleString("es-CL")}</span>
            <a href={r.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
              {r.store}
            </a>
            <span className="text-ink-soft">{r.title}</span>
            <span className="text-ink-mute">({r.match === "igual" ? "mismo producto" : "similar"})</span>
          </li>
        ))}
    </ul>
  );
}
