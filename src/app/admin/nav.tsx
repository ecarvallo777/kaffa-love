"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Menú del admin agrupado por área. El orden de los grupos sigue el día a día: vender, catálogo, bodega. */
const GROUPS = [
  { label: "Inicio", items: [["/admin", "Resumen"]] },
  { label: "Finanzas", items: [["/admin/reportes", "Reportes"], ["/admin/gastos", "Gastos"]] },
  { label: "Ventas", items: [["/admin/pedidos", "Pedidos"], ["/admin/clientes", "Clientes"], ["/admin/ferias", "Ferias"]] },
  { label: "Catálogo", items: [["/admin/productos", "Productos"], ["/admin/precios", "Precios"], ["/admin/recetas", "Recetas"]] },
  { label: "Bodega", items: [["/admin/stock", "Stock"], ["/admin/inventario", "Inventario"], ["/admin/compras", "Compras"]] },
  { label: "Marketing", items: [["/admin/marketing", "Plan e Instagram"]] },
  { label: "Ajustes", items: [["/admin/configuracion", "Configuración"], ["/admin/retiro", "Lugares de retiro"], ["/admin/equipo", "Equipo"]] },
] as const;

const isActive = (href: string, path: string) => (href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`));

const item = (active: boolean) =>
  `shrink-0 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-3 hover:text-ink"}`;

export function AdminNav() {
  const path = usePathname();
  const current = GROUPS.find((g) => g.items.some(([href]) => isActive(href, path))) ?? GROUPS[0];

  return (
    <>
      {/* Celular: grupos arriba y, debajo, los submódulos del grupo actual */}
      <nav aria-label="Áreas" className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] lg:hidden">
        {GROUPS.map((g) => (
          <Link
            key={g.label}
            href={g.items[0][0]}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide uppercase ${g === current ? "bg-paper-3 text-ink" : "text-ink-mute hover:text-ink"}`}
          >
            {g.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Menú del admin" className="flex gap-1 overflow-x-auto px-3 pt-1 pb-3 [scrollbar-width:none] lg:hidden">
        {current.items.map(([href, label]) => (
          <Link key={href} href={href} className={item(isActive(href, path))}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Computador: cada grupo con su título */}
      <nav aria-label="Menú del admin" className="hidden space-y-4 px-3 lg:block">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1 text-[11px] font-medium tracking-[0.12em] text-ink-mute uppercase">{g.label}</p>
            <div className="flex flex-col gap-0.5">
              {g.items.map(([href, label]) => (
                <Link key={href} href={href} className={item(isActive(href, path))}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
