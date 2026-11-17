import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Markdown simple para las guías: ## y ### títulos, párrafos, listas ("-" o "1."),
 * citas (">"), **negrita**, *cursiva* y [enlaces](/ruta). Nunca inserta HTML:
 * todo pasa por React, así que un texto con etiquetas se muestra tal cual.
 */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) out.push(<strong key={k} className="font-medium text-ink">{inline(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k}>{inline(m[2], k)}</em>);
    else {
      const href = m[4];
      const cls = "text-accent underline underline-offset-4 hover:text-accent-deep";
      if (href.startsWith("/")) out.push(<Link key={k} href={href} className={cls}>{m[3]}</Link>);
      else if (/^https:\/\//.test(href)) out.push(<a key={k} href={href} className={cls} rel="noopener noreferrer" target="_blank">{m[3]}</a>);
      else out.push(m[3]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const key = `b${i}`;
    if (!line) { i++; continue; }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key} className="mt-8 font-display text-2xl font-light text-ink">{inline(line.slice(4), key)}</h3>);
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={key} className="mt-12 font-display text-3xl font-light tracking-tight text-ink">{inline(line.slice(3), key)}</h2>);
      i++;
    } else if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) items.push(lines[i++].trim().slice(2));
      blocks.push(<ul key={key} className="mt-4 list-disc space-y-2 pl-6">{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ul>);
    } else if (/^\d+[.)] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)] /.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^\d+[.)] /, ""));
      blocks.push(<ol key={key} className="mt-4 list-decimal space-y-2 pl-6">{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ol>);
    } else if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) quote.push(lines[i++].trim().slice(2));
      blocks.push(<blockquote key={key} className="mt-6 border-l-2 border-accent py-1 pl-6 font-display text-xl font-light text-ink italic">{inline(quote.join(" "), key)}</blockquote>);
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3} |[-*] |\d+[.)] |> )/.test(lines[i].trim())) para.push(lines[i++].trim());
      blocks.push(<p key={key} className="mt-4">{inline(para.join(" "), key)}</p>);
    }
  }
  return <div className="text-lg leading-relaxed text-ink-soft">{blocks}</div>;
}
