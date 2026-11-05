-- Catálogo de EJEMPLO para desarrollo.
-- Cafés y promociones tomados de kaffalove.cl (noviembre 2026).
-- Precios de accesorios y preparados, stock, pesos y medidas son provisionales.

insert into categories (name, slug, sort_order) values
  ('Café de Especialidad', 'cafe-de-especialidad', 1),
  ('Cafetería Hogar',      'cafeteria-hogar',      2),
  ('Regalos y Promociones','regalos',              3),
  ('Preparados',           'preparados',           4);

insert into categories (name, slug, parent_id, sort_order)
select v.name, v.slug, c.id, v.sort_order
from (values
  ('Cafeteras manuales', 'cafeteras-manuales', 1),
  ('Molinillos',         'molinillos',         2),
  ('Accesorios',         'accesorios',         3)
) as v(name, slug, sort_order)
cross join (select id from categories where slug = 'cafeteria-hogar') c;

-- Cafés (bolsa 250 g)
insert into products (name, slug, type, category_id, description, origin, tasting_notes,
                      price_clp, stock, weight_g, length_cm, width_cm, height_cm)
select v.name, v.slug, 'cafe', c.id, v.description, v.origin, v.notes,
       v.price, v.stock, 300, 20, 12, 7
from (values
  ('La Betania, Colombia', 'la-betania-colombia',
   'Café de especialidad de perfil equilibrado, dulce y limpio.', 'Colombia', null, 15900, 20),
  ('Caicedo Blend, Colombia', 'caicedo-blend-colombia',
   'Café de especialidad tostado semanalmente.', 'Colombia',
   'Caña de azúcar, chocolate de leche, mandarina', 13300, 20)
) as v(name, slug, description, origin, notes, price, stock)
cross join (select id from categories where slug = 'cafe-de-especialidad') c;

-- Accesorios
insert into products (name, slug, type, category_id, price_clp, stock, weight_g, length_cm, width_cm, height_cm)
select v.name, v.slug, 'accesorio', c.id, v.price, v.stock, v.weight, v.l, v.w, v.h
from (values
  ('Cafetera tipo Chemex 400 ml',      'cafetera-chemex-400',   'cafeteras-manuales', 19990, 4, 700, 15, 15, 22),
  ('Dripper V60 600 ml',               'dripper-v60-600',       'cafeteras-manuales', 17990, 4, 500, 15, 15, 20),
  ('Tetera cuello de cisne 350 ml',    'tetera-cisne-350',      'accesorios',         14990, 5, 600, 25, 15, 15),
  ('Tetera cuello de cisne 600 ml',    'tetera-cisne-600',      'accesorios',         17990, 5, 800, 28, 16, 16),
  ('Filtros 02 (100 unidades)',        'filtros-02-100',        'accesorios',          5990, 10, 150, 16, 12, 4)
) as v(name, slug, category_slug, price, stock, weight, l, w, h)
join categories c on c.slug = v.category_slug;

-- Promociones (sin stock propio: descuentan de cada producto incluido)
insert into products (name, slug, type, category_id, description, price_clp, track_stock, stock)
select v.name, v.slug, 'promocion', c.id, v.description, v.price, false, 0
from (values
  ('Promo Cafetera + Tetera', 'promo-cafetera-tetera',
   'Cafetera tipo Chemex 400 ml + tetera cuello de cisne 350 ml.', 28950),
  ('Promo V60 + Filtros + Tetera', 'promo-v60-filtros-tetera',
   'Dripper V60 600 ml + tetera 600 ml + filtros 02 (100 unidades).', 39850)
) as v(name, slug, description, price)
cross join (select id from categories where slug = 'regalos') c;

insert into bundle_items (bundle_id, product_id, quantity)
select b.id, p.id, 1
from (values
  ('promo-cafetera-tetera',    'cafetera-chemex-400'),
  ('promo-cafetera-tetera',    'tetera-cisne-350'),
  ('promo-v60-filtros-tetera', 'dripper-v60-600'),
  ('promo-v60-filtros-tetera', 'tetera-cisne-600'),
  ('promo-v60-filtros-tetera', 'filtros-02-100')
) as v(bundle_slug, product_slug)
join products b on b.slug = v.bundle_slug
join products p on p.slug = v.product_slug;

-- Preparados (solo feria). Las bebidas no controlan stock; la torta sí.
insert into products (name, slug, type, category_id, price_clp, track_stock, stock, visible_online)
select v.name, v.slug, 'preparado', c.id, v.price, v.track, v.stock, false
from (values
  ('Americano', 'americano', 2500, false, 0),
  ('Espresso',  'espresso',  2000, false, 0),
  ('Torta',     'torta',     3500, true,  0)
) as v(name, slug, price, track, stock)
cross join (select id from categories where slug = 'preparados') c;

-- Stock inicial registrado en el historial
insert into stock_movements (product_id, delta, reason, note)
select id, stock, 'ajuste', 'Stock inicial de ejemplo'
from products where track_stock and stock > 0;

insert into pickup_locations (name, address, hours) values
  ('Tostaduría Kaffa Love', 'Por definir', 'Por definir');
