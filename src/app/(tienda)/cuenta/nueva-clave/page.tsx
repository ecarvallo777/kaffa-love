import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default function NewPasswordPage(props: PageProps<"/cuenta/nueva-clave">) {
  return (
    <div className="mx-auto max-w-sm px-4 pt-12">
      <h1 className="font-display text-4xl font-light">Crea tu contraseña</h1>
      <div className="mt-8">
        <Suspense>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/cuenta/nueva-clave">, "searchParams">) {
  const sp = await searchParams;
  const token = typeof sp.token_hash === "string" ? sp.token_hash : "";
  if (!token) return <p className="text-ink-soft">El enlace no es válido. <Link href="/cuenta/recuperar" className="underline">Pide uno nuevo</Link>.</p>;
  return <NewPasswordForm tokenHash={token} />;
}
