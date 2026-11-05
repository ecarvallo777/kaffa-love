import type { Grind } from "@/lib/catalog-types";

export const GRINDS: { value: Grind; label: string; methods: string; tip: string }[] = [
  {
    value: "grano",
    label: "En grano",
    methods: "Si tienes molinillo",
    tip: "Lo mueles justo antes de preparar: así conserva mejor sus aromas.",
  },
  {
    value: "fina",
    label: "Fina",
    methods: "Espresso · moka",
    tip: "Partículas pequeñas para extracciones cortas y con presión.",
  },
  {
    value: "media",
    label: "Media",
    methods: "V60 · Chemex · goteo",
    tip: "El punto medio para métodos de filtrado.",
  },
  {
    value: "gruesa",
    label: "Gruesa",
    methods: "Prensa francesa · cold brew",
    tip: "Partículas grandes para infusiones largas.",
  },
];

export const grindLabel = (g: Grind | null | undefined) =>
  GRINDS.find((x) => x.value === g)?.label ?? null;
