import { connection } from "next/server";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/ingresar/actions";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Feria", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#ede4d5", width: "device-width", initialScale: 1, maximumScale: 1 };

export default function FairLayout({ children }: LayoutProps<"/feria">) {
  return (
    <Suspense fallback={<div className="p-10 text-ink-mute">Cargando…</div>}>
      <FairShell>{children}</FairShell>
    </Suspense>
  );
}

async function FairShell({ children }: { children: React.ReactNode }) {
  await connection();
  const staff = await requireStaff(["admin", "operador"], "/feria");
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-paper-2 px-4 py-2.5 text-ink">
        <Link href="/feria" className="flex items-center gap-2" aria-label="Kaffa Love · Feria">
          <Wordmark className="h-8" />
          <span className="text-sm text-ink-mute">· Feria</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-ink-soft">
          <span className="hidden sm:inline">{staff.name}</span>
          {staff.role === "admin" && <Link href="/admin" className="hover:text-ink">Admin</Link>}
          <form action={signOut}><button className="hover:text-ink">Salir</button></form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
