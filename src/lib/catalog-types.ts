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
