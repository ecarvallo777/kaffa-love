-- Ficha completa del café y costos de productos en la base de datos
-- (antes estaban en archivos JSON del almacenamiento de configuración).
-- Solo agrega columnas opcionales y una tabla nueva: el código anterior sigue funcionando.

-- Ficha del café: pública, como origen, proceso y variedad
alter table products
  add column if not exists farm      text,
  add column if not exists region    text,
  add column if not exists altitude  text,
  add column if not exists drying    text,
  add column if not exists harvest   text,
  add column if not exists sca_score numeric(4,2) check (sca_score between 0 and 100);

-- Costo unitario neto (sin IVA). Va en su propia tabla porque products es de
-- lectura pública y los costos no deben verse desde la tienda.
create table if not exists product_costs (
  product_id uuid primary key references products(id) on delete cascade,
  cost_clp   integer not null check (cost_clp >= 0),
  updated_at timestamptz not null default now()
);

-- Cerrada: sin políticas, solo el servidor de la aplicación (clave secreta) la lee y escribe
alter table product_costs enable row level security;
