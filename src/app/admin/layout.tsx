import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";
import { signOut } from "@/app/ingresar/actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Admin Kaffa Love" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-10 text-ink-mute">Cargando…</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();
  const staff = await requireStaff(["admin"], "/admin");
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* En escritorio: columna fija a la altura de la pantalla, con el menú desplazable
          y el pie (cuenta y accesos) siempre visible abajo */}
      <aside className="border-b border-line bg-paper-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:shrink-0 lg:px-5 lg:pt-6 lg:pb-4">
          <Link href="/admin" aria-label="Resumen">
            <Wordmark className="[&_span:last-child]:text-xl" />
          </Link>
          <p className="hidden text-xs text-ink-mute lg:mt-2 lg:block">Administración</p>
          {/* En celular: accesos en la barra superior */}
          <div className="flex items-center gap-3 text-sm text-ink-soft lg:hidden">
            <Link href="/feria" className="hover:text-ink">Feria</Link>
            <Link href="/" className="hover:text-ink">Tienda</Link>
            <form action={signOut}>
              <button className="hover:text-accent">Salir</button>
            </form>
          </div>
        </div>
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-3">
          <AdminNav />
        </div>
        <div className="hidden shrink-0 border-t border-line px-5 py-4 text-sm lg:block">
          <p className="truncate font-medium">{staff.name}</p>
          <p className="truncate text-xs text-ink-mute">{staff.email}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 whitespace-nowrap text-ink-soft">
            <Link href="/feria" className="hover:text-ink">Feria →</Link>
            <Link href="/" className="hover:text-ink">Tienda →</Link>
            <form action={signOut}>
              <button className="hover:text-accent">Cerrar sesión</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
