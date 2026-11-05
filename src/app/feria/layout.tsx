import { connection } from "next/server";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/ingresar/actions";

export const metadata: Metadata = { title: "Feria", robots: { index: false } };
export const viewport: Viewport = { themeColor: "#1d1511", width: "device-width", initialScale: 1, maximumScale: 1 };

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
      <header className="flex items-center justify-between gap-4 bg-ink px-4 py-2.5 text-paper">
        <Link href="/feria" className="font-display text-lg">
          Kaffa <span className="italic">Love</span> <span className="text-sm text-paper/60">· Feria</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-paper/80">
          <span className="hidden sm:inline">{staff.name}</span>
          {staff.role === "admin" && <Link href="/admin" className="hover:text-paper">Admin</Link>}
          <form action={signOut}><button className="hover:text-paper">Salir</button></form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
