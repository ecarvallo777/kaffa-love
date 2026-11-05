/** Notas de cata como chips, con un color que evoca cada sabor */

const FLAVOR_COLORS: [RegExp, string][] = [
  [/chocolate|cacao|cocoa/, "#5a3522"],
  [/caramelo|caña|panela|azúcar|miel|toffee/, "#c4873a"],
  [/mandarina|naranja|cítric|limón|pomelo|lima/, "#e07a2e"],
  [/frutilla|frambuesa|cereza|frutos rojos|guinda|arándano/, "#b4432c"],
  [/ciruela|uva|mora|vino/, "#6b3550"],
  [/durazno|damasco|mango|piña|tropical/, "#e0a03a"],
  [/manzana|pera/, "#8aa14a"],
  [/flor|jazmín|floral|rosa|té/, "#c06a8a"],
  [/nuez|almendra|maní|avellana/, "#9b6a3f"],
  [/vainilla|crema|mantequilla/, "#d9c08a"],
  [/especia|canela|clavo/, "#8c4a2a"],
];

export function flavorColor(note: string) {
  return FLAVOR_COLORS.find(([re]) => re.test(note))?.[1] ?? "#8b7c70";
}

export function TastingNotes({ notes, size = "md" }: { notes: string[]; size?: "md" | "lg" }) {
  if (!notes.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {notes.map((n) => (
        <li
          key={n}
          className={`inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 ${
            size === "lg" ? "px-4 py-2 text-base" : "px-3 py-1 text-sm"
          }`}
        >
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: flavorColor(n) }}
            aria-hidden
          />
          {n}
        </li>
      ))}
    </ul>
  );
}
