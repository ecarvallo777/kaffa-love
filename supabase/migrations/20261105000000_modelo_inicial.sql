-- Kaffa Love: modelo de datos inicial
-- Ver docs/MODELO-DATOS.md para la explicación de cada tabla.

-- Tipos -------------------------------------------------------------------

create type product_type   as enum ('cafe', 'accesorio', 'promocion', 'preparado');
create type grind_type     as enum ('grano', 'fina', 'media', 'gruesa');
create type sales_channel  as enum ('online', 'feria');
create type order_status   as enum (
  'pendiente_pago', 'pagado', 'rechazado', 'expirado',
  'en_preparacion', 'despachado', 'listo_retiro', 'entregado', 'cancelado'
);
create type delivery_method as enum ('despacho', 'retiro', 'presencial');
create type stock_reason   as enum ('pedido', 'liberacion', 'compra', 'ajuste', 'migracion', 'inicio_jornada');
create type staff_role     as enum ('admin', 'operador');

-- Catálogo ----------------------------------------------------------------

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  parent_id   uuid references categories(id),
  sort_order  integer not null default 0,
  active      boolean not null default true
);

create table products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text unique,
  name                text not null,
  slug                text not null unique,
  type                product_type not null,
  category_id         uuid references categories(id),
  description         text,
  -- Ficha del café
  origin              text,
  process             text,
  variety             text,
  tasting_notes       text,
  -- Precio en CLP con IVA incluido
  price_clp           integer not null check (price_clp >= 0),
  -- Stock disponible (ya descontadas las reservas)
  track_stock         boolean not null default true,
  stock               integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 3,
  -- Datos físicos para cotizar despacho
  weight_g            integer check (weight_g > 0),
  length_cm           numeric(6,1),
  width_cm            numeric(6,1),
  height_cm           numeric(6,1),
  visible_online      boolean not null default true,
  active              boolean not null default true,
  image_urls          text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint preparado_solo_feria check (type <> 'preparado' or visible_online = false),
  constraint promocion_sin_stock_propio check (type <> 'promocion' or track_stock = false)
);

-- Productos que incluye cada promoción
create table bundle_items (
  bundle_id   uuid not null references products(id) on delete cascade,
  product_id  uuid not null references products(id),
  quantity    integer not null default 1 check (quantity > 0),
  primary key (bundle_id, product_id),
  check (bundle_id <> product_id)
);

-- Clientes ----------------------------------------------------------------

create table customers (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  name                text,
  phone               text,
  auth_user_id        uuid unique,           -- se llena si el cliente crea cuenta
  marketing_consent   boolean not null default false,
  marketing_consent_at timestamptz,
  source              text not null default 'tienda', -- 'tienda' o 'prestashop'
  created_at          timestamptz not null default now()
);

create table addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  street       text not null,
  number       text,
  apartment    text,
  commune      text not null,
  region       text not null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Entrega y feria -----------------------------------------------------------

create table pickup_locations (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  address  text not null,
  hours    text not null,
  active   boolean not null default true
);

create table fair_sessions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  location           text,
  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  opened_by          uuid,
  point_total_clp    integer,   -- total informado por Mercado Pago Point al cerrar
  notes              text
);

-- Pedidos online y ventas de feria ---------------------------------------------

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  number             bigint generated always as identity unique,
  channel            sales_channel not null,
  status             order_status not null default 'pendiente_pago',
  customer_id        uuid references customers(id),
  fair_session_id    uuid references fair_sessions(id),
  delivery           delivery_method not null,
  shipping_address   jsonb,
  pickup_location_id uuid references pickup_locations(id),
  subtotal_clp       integer not null check (subtotal_clp >= 0),
  shipping_clp       integer not null default 0 check (shipping_clp >= 0),
  total_clp          integer not null,
  reserved_until     timestamptz,
  mp_preference_id   text,
  mp_payment_id      text unique,
  shipping_service   text,
  tracking_number    text,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,
  updated_at         timestamptz not null default now(),
  constraint total_cuadra check (total_clp = subtotal_clp + shipping_clp),
  constraint feria_con_jornada check (channel <> 'feria' or fair_session_id is not null),
  constraint feria_presencial check ((channel = 'feria') = (delivery = 'presencial')),
  constraint despacho_con_direccion check (delivery <> 'despacho' or shipping_address is not null),
  constraint retiro_con_lugar check (delivery <> 'retiro' or pickup_location_id is not null)
);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  product_id      uuid not null references products(id),
  product_name    text not null,      -- copia del nombre al momento de la venta
  unit_price_clp  integer not null check (unit_price_clp >= 0),
  quantity        integer not null check (quantity > 0),
  grind           grind_type          -- solo para cafés
);

-- Historial ------------------------------------------------------------------

-- Cada cambio de stock queda registrado con su motivo
create table stock_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references products(id),
  delta       integer not null check (delta <> 0),
  reason      stock_reason not null,
  order_id    uuid references orders(id),
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- Eventos importantes del negocio (base para agentes y reportes)
create table events (
  id          bigint generated always as identity primary key,
  type        text not null,   -- p. ej. 'pedido_creado', 'pago_confirmado', 'venta_feria'
  entity      text not null,   -- p. ej. 'order', 'product'
  entity_id   uuid,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Personal autorizado (administración y feria)
create table staff (
  user_id  uuid primary key,   -- id del usuario en Supabase Auth
  name     text not null,
  role     staff_role not null
);

create index on products (category_id) where active;
create index on orders (channel, created_at);
create index on orders (status, reserved_until) where status = 'pendiente_pago';
create index on order_items (order_id);
create index on stock_movements (product_id, created_at);
create index on stock_movements (order_id);
create index on events (type, created_at);

-- Stock ------------------------------------------------------------------------

-- Cuánto stock necesita un pedido, expandiendo las promociones a sus productos
create function order_stock_needs(p_order_id uuid)
returns table (product_id uuid, qty integer)
language sql stable
set search_path = public
as $$
  select x.product_id, sum(x.qty)::integer
  from (
    select oi.product_id, oi.quantity as qty
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.type <> 'promocion'
    union all
    select bi.product_id, oi.quantity * bi.quantity
    from order_items oi
    join bundle_items bi on bi.bundle_id = oi.product_id
    where oi.order_id = p_order_id
  ) x
  join products p on p.id = x.product_id
  where p.track_stock
  group by x.product_id;
$$;

-- Descuenta (reserva) el stock de un pedido. Si falta stock de cualquier
-- producto, no descuenta nada y lanza el error SIN_STOCK.
create function reserve_order_stock(p_order_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  if exists (select 1 from stock_movements where order_id = p_order_id) then
    raise exception 'STOCK_YA_RESERVADO';
  end if;

  -- Orden fijo para evitar bloqueos entre ventas simultáneas
  for r in select * from order_stock_needs(p_order_id) order by product_id loop
    update products
       set stock = stock - r.qty, updated_at = now()
     where id = r.product_id and stock >= r.qty;

    if not found then
      raise exception 'SIN_STOCK:%', r.product_id;
    end if;

    insert into stock_movements (product_id, delta, reason, order_id)
    values (r.product_id, -r.qty, 'pedido', p_order_id);
  end loop;
end;
$$;

-- Devuelve el stock reservado por un pedido. Se puede llamar más de una vez
-- sin devolver dos veces.
create function release_order_stock(p_order_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select product_id, -sum(delta)::integer as qty
      from stock_movements
     where order_id = p_order_id
     group by product_id
    having sum(delta) < 0
     order by product_id
  loop
    update products set stock = stock + r.qty, updated_at = now() where id = r.product_id;
    insert into stock_movements (product_id, delta, reason, order_id)
    values (r.product_id, r.qty, 'liberacion', p_order_id);
  end loop;
end;
$$;

-- Marca como expirados los pedidos online sin pagar cuya reserva venció
-- y libera su stock. Se ejecutará periódicamente.
create function expire_pending_orders()
returns integer
language plpgsql
set search_path = public
as $$
declare
  o record;
  n integer := 0;
begin
  for o in
    select id from orders
     where status = 'pendiente_pago' and reserved_until < now()
     for update skip locked
  loop
    perform release_order_stock(o.id);
    update orders set status = 'expirado', updated_at = now() where id = o.id;
    insert into events (type, entity, entity_id) values ('pedido_expirado', 'order', o.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Las funciones de stock solo las usa el servidor de la aplicación
revoke execute on function order_stock_needs(uuid), reserve_order_stock(uuid),
  release_order_stock(uuid), expire_pending_orders() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function order_stock_needs(uuid), reserve_order_stock(uuid),
      release_order_stock(uuid), expire_pending_orders() from anon, authenticated;
  end if;
end $$;

-- Seguridad (Row Level Security) ------------------------------------------------
-- Todas las tablas quedan cerradas por defecto. El público solo puede leer el
-- catálogo visible; todo lo demás pasa por el servidor de la aplicación, que
-- verifica los permisos del personal.

alter table categories       enable row level security;
alter table products         enable row level security;
alter table bundle_items     enable row level security;
alter table customers        enable row level security;
alter table addresses        enable row level security;
alter table pickup_locations enable row level security;
alter table fair_sessions    enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table stock_movements  enable row level security;
alter table events           enable row level security;
alter table staff            enable row level security;

create policy "catálogo público: categorías" on categories
  for select using (active);

create policy "catálogo público: productos" on products
  for select using (active and visible_online);

create policy "catálogo público: promociones" on bundle_items
  for select using (
    exists (select 1 from products p where p.id = bundle_id and p.active and p.visible_online)
  );

create policy "catálogo público: lugares de retiro" on pickup_locations
  for select using (active);
