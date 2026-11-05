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
      <aside className="border-b border-line bg-paper-2 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/admin" aria-label="Resumen">
            <Wordmark className="[&_span:last-child]:text-xl" />
          </Link>
          <p className="text-xs text-ink-mute lg:mt-2">Administración</p>
        </div>
        <AdminNav />
        <div className="hidden px-5 pt-6 text-sm lg:block">
          <p className="truncate font-medium">{staff.name}</p>
          <p className="truncate text-xs text-ink-mute">{staff.email}</p>
          <div className="mt-3 flex flex-col items-start gap-1.5 text-ink-soft">
            <Link href="/feria" className="hover:text-ink">Ir a la feria →</Link>
            <Link href="/" className="hover:text-ink">Ver la tienda →</Link>
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
