export type ProductType = "cafe" | "accesorio" | "promocion" | "preparado";
export type Grind = "grano" | "fina" | "media" | "gruesa";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  category_id: string | null;
  description: string | null;
  origin: string | null;
  process: string | null;
  variety: string | null;
  tasting_notes: string | null;
  // Ficha extendida del café: solo la trae el catálogo de la tienda (feria y pedidos no la necesitan)
  farm?: string | null;
  region?: string | null;
  altitude?: string | null;
  drying?: string | null;
  harvest?: string | null;
  /** Puntaje de catación SCA (0–100) */
  sca_score?: number | null;
  price_clp: number;
  track_stock: boolean;
  stock: number;
  low_stock_threshold: number;
  image_urls: string[];
};

export type BundleItem = {
  bundle_id: string;
  product_id: string;
  quantity: number;
};

export type Catalog = {
  categories: Category[];
  products: Product[];
  bundleItems: BundleItem[];
};
