"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/admin", "Resumen"],
  ["/admin/reportes", "Reportes"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/productos", "Productos"],
  ["/admin/recetas", "Recetas"],
  ["/admin/stock", "Stock"],
  ["/admin/inventario", "Inventario"],
  ["/admin/compras", "Compras"],
  ["/admin/ferias", "Ferias"],
  ["/admin/retiro", "Lugares de retiro"],
  ["/admin/configuracion", "Configuración"],
  ["/admin/equipo", "Equipo"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:px-3 lg:pb-0">
      {ITEMS.map(([href, label]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm transition-colors ${
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-3 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
