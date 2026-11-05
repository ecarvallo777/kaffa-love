import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default function LoginPage(props: PageProps<"/ingresar">) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
      <Wordmark />
      <h1 className="mt-8 font-display text-3xl">Acceso del equipo</h1>
      <p className="mt-2 text-center text-sm text-ink-soft">Administración y venta en feria.</p>
      <Suspense>
        <LoginParams searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginParams({ searchParams }: Pick<PageProps<"/ingresar">, "searchParams">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "";
  const error = sp.error === "permiso" ? "Tu usuario no tiene permiso para esa sección." : null;
  return <LoginForm next={next} initialError={error} />;
}
