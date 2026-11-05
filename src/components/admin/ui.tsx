import Link from "next/link";
import { ORDER_STATUS } from "@/lib/format";

/* Piezas de interfaz del panel de administración */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white/60 p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-xl">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/60 p-5">
      <p className="text-xs tracking-[0.14em] text-ink-mute uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

const TONES = {
  ok: "bg-leaf/15 text-leaf",
  info: "bg-[#2f4a68]/12 text-[#2f4a68]",
  wait: "bg-crema/20 text-[#8a5a1c]",
  bad: "bg-accent/12 text-accent-deep",
  neutral: "bg-paper-3 text-ink-soft",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "info" as const };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white/60">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-ink-mute [&_th]:uppercase [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-paper-2/60">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-soft">{children}</p>;
}

export const btn = {
  primary: "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-50",
  secondary: "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-white/70 px-5 text-sm font-medium transition-colors hover:border-ink disabled:opacity-50",
  danger: "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-accent/40 px-5 text-sm font-medium text-accent-deep transition-colors hover:bg-accent hover:text-white disabled:opacity-50",
};

export const field = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-ink";
export const textarea = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export function LinkButton({ href, children, variant = "secondary" }: { href: string; children: React.ReactNode; variant?: keyof typeof btn }) {
  return (
    <Link href={href} className={btn[variant]}>
      {children}
    </Link>
  );
}
