"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { Card, Pill, Table, btn } from "@/components/admin/ui";
import { applyPurchase, previewPurchase, type PreviewState } from "./actions";

export function PurchaseImport() {
  const [preview, previewAction, previewing] = useActionState(previewPurchase, null);
  const [result, applyAction, applying] = useActionState(applyPurchase, null as PreviewState);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = preview?.rows ?? [];
  const valid = rows.filter((r) => r.kind !== "error");
  const errors = rows.filter((r) => r.kind === "error");

  return (
    <div className="space-y-6">
      <Card title="1. Descarga la plantilla">
        <p className="text-sm text-ink-soft">
          Incluye una hoja con tus productos actuales (para copiar su SKU o dirección web) y otra con las categorías.
        </p>
        <a href="/admin/compras/plantilla" className={`${btn.secondary} mt-4`}>Descargar plantilla .xlsx</a>
      </Card>

      <Card title="2. Sube la planilla completada">
        <form action={previewAction} className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" name="file" accept=".xlsx" required className="text-sm" />
          <button disabled={previewing} className={btn.primary}>{previewing ? "Leyendo…" : "Ver vista previa"}</button>
        </form>
        {preview?.error && <p role="alert" className="mt-3 text-sm text-accent-deep">{preview.error}</p>}
      </Card>

      {rows.length > 0 && !result?.applied && (
        <Card title="3. Revisa y confirma">
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Pill tone="info">{rows.filter((r) => r.kind === "existente").length} suman stock</Pill>
            <Pill tone="ok">{rows.filter((r) => r.kind === "nuevo").length} productos nuevos</Pill>
            {errors.length > 0 && <Pill tone="bad">{errors.length} filas con errores (no se aplican)</Pill>}
          </div>
          <Table>
            <thead>
              <tr><th>Fila</th><th>Producto</th><th>Acción</th><th className="text-right">Cantidad</th><th className="text-right">Costo</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row} className={r.kind === "error" ? "bg-accent/5" : ""}>
                  <td className="text-ink-mute">{r.row}</td>
                  <td>{r.name}</td>
                  <td>
                    {r.kind === "existente" && <span>Stock {r.stockBefore} → <b>{(r.stockBefore ?? 0) + r.qty}</b></span>}
                    {r.kind === "nuevo" && <Pill tone="ok">Nuevo · {r.newProduct?.type} · ${r.newProduct?.priceClp.toLocaleString("es-CL")}</Pill>}
                    {r.kind === "error" && <span className="text-accent-deep">{r.message}</span>}
                  </td>
                  <td className="text-right tabular-nums">{r.kind === "error" ? "—" : `+${r.qty}`}</td>
                  <td className="text-right tabular-nums">{r.costClp !== null ? `$${r.costClp.toLocaleString("es-CL")}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <form
            action={(fd) => {
              const f = fileRef.current?.files?.[0];
              if (f) fd.set("file", f);
              applyAction(fd);
            }}
            className="mt-4"
          >
            <button disabled={applying || !valid.length} className={btn.primary}>
              {applying ? "Aplicando…" : `Confirmar y aplicar ${valid.length} filas`}
            </button>
          </form>
        </Card>
      )}

      {result?.applied && (
        <Card title="Compra aplicada" className="border-leaf/40 bg-leaf/5">
          <p className="text-sm">{result.applied}</p>
          {result.error && <p className="mt-2 text-sm text-accent-deep">{result.error}</p>}
          <div className="mt-4 flex gap-2">
            <Link href="/admin/stock" className={btn.secondary}>Ver movimientos de stock</Link>
            <Link href="/admin/productos" className={btn.secondary}>Ver productos</Link>
          </div>
        </Card>
      )}
      {result?.error && !result.applied && <p role="alert" className="text-sm text-accent-deep">{result.error}</p>}
    </div>
  );
}
