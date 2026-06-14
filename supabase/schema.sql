create extension if not exists pgcrypto;

do $$ begin
  create type public.order_source as enum ('website', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('reserved', 'awaiting_payment', 'pending_confirmation', 'paid', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('bank_transfer', 'qris');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfillment_status as enum ('unfulfilled', 'packed', 'shipped', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price integer not null check (price > 0),
  image_url text not null,
  images jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  color_hex jsonb not null default '{}'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  is_live boolean not null default false,
  active boolean not null default true,
  weight_grams integer not null default 500 check (weight_grams > 0),
  length_cm integer not null default 20 check (length_cm > 0),
  width_cm integer not null default 20 check (width_cm > 0),
  height_cm integer not null default 5 check (height_cm > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserved_not_over_stock check (reserved_quantity <= stock_quantity)
);

alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists weight_grams integer not null default 500;
alter table public.products add column if not exists length_cm integer not null default 20;
alter table public.products add column if not exists width_cm integer not null default 20;
alter table public.products add column if not exists height_cm integer not null default 5;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  color text not null,
  color_hex text not null default '#8a2949',
  size text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variant_reserved_not_over_stock check (reserved_quantity <= stock_quantity),
  constraint unique_product_variant unique (product_id, color, size)
);

create table if not exists public.shipping_services (
  id uuid primary key default gen_random_uuid(),
  courier_code text not null,
  courier_name text not null,
  service_code text not null,
  service_name text not null,
  flat_price integer not null default 0 check (flat_price >= 0),
  eta text not null,
  enabled boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'biteship')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_shipping_service unique (courier_code, service_code)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  type public.payment_method not null,
  name text not null,
  bank_code text,
  account_number text,
  account_holder text,
  qris_payload text,
  instructions text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_payment_method_name unique (name)
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source public.order_source not null,
  status public.order_status not null default 'awaiting_payment',
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  variant_sku text not null default '',
  product_code text not null,
  product_name text not null,
  product_image text not null,
  unit_price integer not null,
  quantity integer not null default 1 check (quantity > 0),
  color text not null,
  size text not null,
  buyer_name text not null,
  whatsapp text not null,
  address jsonb not null,
  shipping jsonb not null,
  payment_method public.payment_method not null,
  payment_method_id uuid references public.payment_methods(id),
  payment_details jsonb not null default '{}'::jsonb,
  proof_name text,
  proof_path text,
  rejection_reason text,
  admin_note text,
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  waybill text,
  tracking_url text,
  subtotal integer not null,
  total integer not null,
  reserved_until timestamptz not null,
  paid_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  live_session_id uuid references public.live_sessions(id) on delete set null,
  public_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists variant_id uuid references public.product_variants(id);
alter table public.orders add column if not exists variant_sku text not null default '';
alter table public.orders add column if not exists payment_method_id uuid references public.payment_methods(id);
alter table public.orders add column if not exists payment_details jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists proof_path text;
alter table public.orders add column if not exists rejection_reason text;
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists fulfillment_status public.fulfillment_status not null default 'unfulfilled';
alter table public.orders add column if not exists waybill text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists packed_at timestamptz;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists live_session_id uuid references public.live_sessions(id) on delete set null;
alter table public.orders add column if not exists public_token uuid not null default gen_random_uuid();

create table if not exists public.overlay_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('purchase', 'product')),
  buyer_display text,
  product_code text not null,
  product_name text not null,
  product_price integer not null default 0,
  source public.order_source,
  message text not null,
  duration integer not null default 7 check (duration between 3 and 30),
  sound boolean not null default true,
  delivered_at timestamptz,
  delivery_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.overlay_events add column if not exists delivered_at timestamptz;
alter table public.overlay_events add column if not exists delivery_count integer not null default 0;

create table if not exists public.overlay_clients (
  client_id text primary key,
  last_seen timestamptz not null default now(),
  current_event_id uuid references public.overlay_events(id) on delete set null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'admin',
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create index if not exists product_variants_available_idx on public.product_variants (product_id, active, stock_quantity, reserved_quantity);
create index if not exists payment_methods_enabled_idx on public.payment_methods (enabled, sort_order);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_product_id_idx on public.orders (product_id);
create index if not exists orders_variant_id_idx on public.orders (variant_id);
create index if not exists orders_live_session_id_idx on public.orders (live_session_id);
create index if not exists orders_reservation_expiry_idx on public.orders (reserved_until) where status in ('reserved', 'awaiting_payment', 'pending_confirmation');
create index if not exists overlay_events_created_at_idx on public.overlay_events (created_at desc);
create index if not exists overlay_clients_last_seen_idx on public.overlay_clients (last_seen desc);
create index if not exists overlay_clients_current_event_id_idx on public.overlay_clients (current_event_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists rate_limit_key_created_at_idx on public.rate_limit_events (key, created_at desc);
create unique index if not exists only_one_live_product_idx on public.products (is_live) where is_live = true;
create unique index if not exists only_one_active_live_session_idx on public.live_sessions (status) where status = 'active';

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.shipping_services enable row level security;
alter table public.payment_methods enable row level security;
alter table public.live_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.overlay_events enable row level security;
alter table public.overlay_clients enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limit_events enable row level security;

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select to anon using (active = true);
drop policy if exists "Public can read variants" on public.product_variants;
drop policy if exists "Public can read active variants" on public.product_variants;
create policy "Public can read active variants" on public.product_variants for select to anon using (active = true);
drop policy if exists "Public can read shipping services" on public.shipping_services;
drop policy if exists "Public can read active shipping services" on public.shipping_services;
create policy "Public can read active shipping services" on public.shipping_services for select to anon using (enabled = true);
drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods" on public.payment_methods for select to anon using (enabled = true);
drop policy if exists "Public can read overlay events" on public.overlay_events;

create or replace function public.refresh_product_totals(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.products p set
    stock_quantity = coalesce(v.stock, 0),
    reserved_quantity = coalesce(v.reserved, 0),
    updated_at = now()
  from (
    select product_id, sum(stock_quantity)::integer as stock, sum(reserved_quantity)::integer as reserved
    from public.product_variants where product_id = p_product_id and active = true group by product_id
  ) v where p.id = p_product_id and v.product_id = p.id;
  if not found then update public.products set stock_quantity = 0, reserved_quantity = 0, updated_at = now() where id = p_product_id; end if;
end;
$$;

create or replace function public.sync_product_variant_totals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_product_totals(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_product_variant_totals_trigger on public.product_variants;
create trigger sync_product_variant_totals_trigger after insert or update or delete on public.product_variants
for each row execute function public.sync_product_variant_totals();

create or replace function public.make_order_number(p_source public.order_source)
returns text language sql volatile set search_path = public as $$
  select (case when p_source = 'website' then 'WEB' else 'WA' end)
    || '-' || to_char(clock_timestamp(), 'DDMMYY-HH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.expire_reservations()
returns integer language plpgsql security definer set search_path = public as $$
declare order_row public.orders; expired_count integer := 0;
begin
  for order_row in
    select * from public.orders
    where status in ('reserved', 'awaiting_payment', 'pending_confirmation') and reserved_until <= now()
    for update skip locked
  loop
    if order_row.variant_id is not null then
      update public.product_variants set reserved_quantity = greatest(0, reserved_quantity - order_row.quantity), updated_at = now() where id = order_row.variant_id;
    end if;
    update public.orders set status = 'cancelled', admin_note = coalesce(admin_note, 'Reservasi dilepas otomatis karena melewati batas waktu.'), updated_at = now() where id = order_row.id;
    expired_count := expired_count + 1;
  end loop;
  delete from public.rate_limit_events where created_at < now() - interval '24 hours';
  return expired_count;
end;
$$;

drop function if exists public.reserve_order(uuid, public.order_source, integer, text, text, text, text, jsonb, jsonb, public.payment_method, text);
create or replace function public.reserve_order(
  p_product_id uuid,
  p_variant_id uuid,
  p_source public.order_source,
  p_quantity integer,
  p_buyer_name text,
  p_whatsapp text,
  p_address jsonb,
  p_shipping jsonb,
  p_payment_method public.payment_method,
  p_proof_name text default null
)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  product_row public.products;
  variant_row public.product_variants;
  order_row public.orders;
  shipping_price integer;
  session_id uuid;
begin
  perform public.expire_reservations();
  select * into product_row from public.products where id = p_product_id and active = true for update;
  if not found then raise exception 'Produk tidak ditemukan atau tidak aktif'; end if;
  select * into variant_row from public.product_variants where id = p_variant_id and product_id = p_product_id and active = true for update;
  if not found then raise exception 'Varian produk tidak ditemukan'; end if;
  if variant_row.stock_quantity - variant_row.reserved_quantity < p_quantity then raise exception 'Stok varian tidak mencukupi'; end if;
  shipping_price := coalesce((p_shipping->>'price')::integer, 0);
  select id into session_id from public.live_sessions where status = 'active' order by started_at desc limit 1;
  update public.product_variants set reserved_quantity = reserved_quantity + p_quantity, updated_at = now() where id = p_variant_id;
  insert into public.orders (
    order_number, source, status, product_id, variant_id, variant_sku, product_code, product_name, product_image,
    unit_price, quantity, color, size, buyer_name, whatsapp, address, shipping, payment_method, proof_name,
    subtotal, total, reserved_until, live_session_id
  ) values (
    public.make_order_number(p_source), p_source,
    case when p_proof_name is null then 'awaiting_payment'::public.order_status else 'pending_confirmation'::public.order_status end,
    product_row.id, variant_row.id, variant_row.sku, product_row.code, product_row.name, product_row.image_url,
    product_row.price, p_quantity, variant_row.color, variant_row.size, p_buyer_name, p_whatsapp, p_address, p_shipping,
    p_payment_method, p_proof_name, product_row.price * p_quantity, product_row.price * p_quantity + shipping_price,
    now() + interval '5 minutes', session_id
  ) returning * into order_row;
  return order_row;
end;
$$;

create or replace function public.confirm_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare order_row public.orders; variant_row public.product_variants;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if order_row.status = 'paid' then return order_row; end if;
  if order_row.status in ('cancelled', 'rejected') then raise exception 'Pesanan sudah tidak aktif'; end if;
  if order_row.variant_id is null then
    select * into variant_row from public.product_variants where product_id = order_row.product_id and color = order_row.color and size = order_row.size limit 1 for update;
  else
    select * into variant_row from public.product_variants where id = order_row.variant_id for update;
  end if;
  if not found or variant_row.stock_quantity < order_row.quantity then raise exception 'Stok varian tidak mencukupi'; end if;
  update public.product_variants set stock_quantity = stock_quantity - order_row.quantity, reserved_quantity = greatest(0, reserved_quantity - order_row.quantity), updated_at = now() where id = variant_row.id;
  update public.orders set status = 'paid', variant_id = variant_row.id, variant_sku = variant_row.sku, paid_at = now(), updated_at = now() where id = p_order_id returning * into order_row;
  return order_row;
end;
$$;

create or replace function public.release_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if order_row.status not in ('paid', 'cancelled', 'rejected') and order_row.variant_id is not null then
    update public.product_variants set reserved_quantity = greatest(0, reserved_quantity - order_row.quantity), updated_at = now() where id = order_row.variant_id;
  end if;
  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id returning * into order_row;
  return order_row;
end;
$$;

create or replace function public.reject_order(p_order_id uuid, p_reason text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if order_row.status not in ('paid', 'cancelled', 'rejected') and order_row.variant_id is not null then
    update public.product_variants set reserved_quantity = greatest(0, reserved_quantity - order_row.quantity), updated_at = now() where id = order_row.variant_id;
  end if;
  update public.orders set status = 'rejected', rejection_reason = p_reason, updated_at = now() where id = p_order_id returning * into order_row;
  return order_row;
end;
$$;

create or replace function public.set_live_product(p_product_id uuid)
returns public.products language plpgsql security definer set search_path = public as $$
declare product_row public.products;
begin
  update public.products set is_live = false, updated_at = now() where is_live = true and id <> p_product_id;
  update public.products set is_live = true, updated_at = now() where id = p_product_id and active = true returning * into product_row;
  if not found then raise exception 'Produk tidak ditemukan atau tidak aktif'; end if;
  return product_row;
end;
$$;

create or replace function public.save_product(p_product_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target_product_id uuid := p_product_id;
  variant jsonb;
  variant_id uuid;
  kept_ids uuid[] := '{}';
  product_colors jsonb;
  product_sizes jsonb;
  product_color_hex jsonb;
begin
  select coalesce(jsonb_agg(distinct item->>'color'), '[]'::jsonb) into product_colors from jsonb_array_elements(p_data->'variants') item;
  select coalesce(jsonb_agg(distinct item->>'size'), '[]'::jsonb) into product_sizes from jsonb_array_elements(p_data->'variants') item;
  select coalesce(jsonb_object_agg(item->>'color', item->>'colorHex'), '{}'::jsonb) into product_color_hex from jsonb_array_elements(p_data->'variants') item;

  if target_product_id is null then
    insert into public.products (code, name, description, price, image_url, images, colors, color_hex, sizes, active, weight_grams, length_cm, width_cm, height_cm)
    values (p_data->>'code', p_data->>'name', coalesce(p_data->>'description',''), (p_data->>'price')::integer, p_data->'images'->>0, p_data->'images', product_colors, product_color_hex, product_sizes, (p_data->>'active')::boolean, (p_data->>'weightGrams')::integer, (p_data->>'lengthCm')::integer, (p_data->>'widthCm')::integer, (p_data->>'heightCm')::integer)
    returning id into target_product_id;
  else
    update public.products set code = p_data->>'code', name = p_data->>'name', description = coalesce(p_data->>'description',''), price = (p_data->>'price')::integer, image_url = p_data->'images'->>0, images = p_data->'images', colors = product_colors, color_hex = product_color_hex, sizes = product_sizes, active = (p_data->>'active')::boolean, weight_grams = (p_data->>'weightGrams')::integer, length_cm = (p_data->>'lengthCm')::integer, width_cm = (p_data->>'widthCm')::integer, height_cm = (p_data->>'heightCm')::integer, updated_at = now()
    where id = target_product_id;
    if not found then raise exception 'Produk tidak ditemukan'; end if;
  end if;

  for variant in select * from jsonb_array_elements(p_data->'variants') loop
    variant_id := nullif(variant->>'id','')::uuid;
    if variant_id is null then
      insert into public.product_variants (product_id, sku, color, color_hex, size, stock_quantity, active)
      values (target_product_id, variant->>'sku', variant->>'color', variant->>'colorHex', variant->>'size', (variant->>'stock')::integer, (variant->>'active')::boolean)
      returning id into variant_id;
    else
      update public.product_variants set sku = variant->>'sku', color = variant->>'color', color_hex = variant->>'colorHex', size = variant->>'size', stock_quantity = greatest((variant->>'stock')::integer, reserved_quantity), active = (variant->>'active')::boolean, updated_at = now()
      where id = variant_id and product_id = target_product_id;
      if not found then raise exception 'Varian tidak ditemukan'; end if;
    end if;
    kept_ids := array_append(kept_ids, variant_id);
  end loop;

  if exists (select 1 from public.product_variants where product_id = target_product_id and not (id = any(kept_ids)) and reserved_quantity > 0) then
    raise exception 'Varian dengan reservasi aktif tidak dapat dihapus';
  end if;
  delete from public.product_variants where product_id = target_product_id and not (id = any(kept_ids));
  perform public.refresh_product_totals(target_product_id);
  return target_product_id;
end;
$$;

revoke execute on function public.reserve_order(uuid, uuid, public.order_source, integer, text, text, jsonb, jsonb, public.payment_method, text) from public, anon, authenticated;
revoke execute on function public.confirm_order(uuid) from public, anon, authenticated;
revoke execute on function public.release_order(uuid) from public, anon, authenticated;
revoke execute on function public.reject_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.expire_reservations() from public, anon, authenticated;
revoke execute on function public.set_live_product(uuid) from public, anon, authenticated;
revoke execute on function public.save_product(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.refresh_product_totals(uuid) from public, anon, authenticated;
revoke execute on function public.sync_product_variant_totals() from public, anon, authenticated;
grant execute on function public.reserve_order(uuid, uuid, public.order_source, integer, text, text, jsonb, jsonb, public.payment_method, text) to service_role;
grant execute on function public.confirm_order(uuid) to service_role;
grant execute on function public.release_order(uuid) to service_role;
grant execute on function public.reject_order(uuid, text) to service_role;
grant execute on function public.expire_reservations() to service_role;
grant execute on function public.set_live_product(uuid) to service_role;
grant execute on function public.save_product(uuid, jsonb) to service_role;
grant execute on function public.refresh_product_totals(uuid) to service_role;

insert into public.products (code, name, description, price, image_url, images, colors, color_hex, sizes, active, weight_grams, length_cm, width_cm, height_cm, is_live)
values
  ('101', 'Cardigan Knit Elegance', 'Rajut lembut dengan potongan rileks untuk tampilan feminin sehari-hari.', 199000, '/products/cardigan-101.png', '["/products/cardigan-101.png"]', '["Burgundy","Mocha","Navy"]', '{"Burgundy":"#7d1837","Mocha":"#9b735b","Navy":"#20344e"}', '["S","M","L","XL"]', true, 700, 30, 24, 8, true),
  ('102', 'Pearl Crop Cardigan', 'Cardigan cream bertekstur dengan detail kancing mutiara yang bersih.', 229000, '/products/cardigan-102.png', '["/products/cardigan-102.png"]', '["Cream","Latte","Black"]', '{"Cream":"#eee2d0","Latte":"#c6a98f","Black":"#242021"}', '["S","M","L"]', true, 650, 28, 23, 7, false),
  ('3303', 'Rose Cable Cardigan', 'Cable knit dusty rose dengan siluet sedikit oversized dan hangat.', 249000, '/products/cardigan-3303.png', '["/products/cardigan-3303.png"]', '["Dusty Rose","Oat","Cocoa"]', '{"Dusty Rose":"#b97c87","Oat":"#ded0bb","Cocoa":"#6f5145"}', '["M","L","XL"]', true, 800, 32, 25, 9, false)
on conflict (code) do update set name = excluded.name, description = excluded.description, price = excluded.price, images = excluded.images, colors = excluded.colors, color_hex = excluded.color_hex, sizes = excluded.sizes, weight_grams = excluded.weight_grams, length_cm = excluded.length_cm, width_cm = excluded.width_cm, height_cm = excluded.height_cm;

insert into public.product_variants (product_id, sku, color, color_hex, size, stock_quantity, reserved_quantity, active)
select p.id, v.sku, v.color, v.color_hex, v.size, v.stock, 0, true
from public.products p join (values
  ('101','101-BUR-S','Burgundy','#7d1837','S',3), ('101','101-BUR-M','Burgundy','#7d1837','M',3), ('101','101-MOC-L','Mocha','#9b735b','L',3), ('101','101-NAV-XL','Navy','#20344e','XL',3),
  ('102','102-CRE-S','Cream','#eee2d0','S',3), ('102','102-LAT-M','Latte','#c6a98f','M',3), ('102','102-BLK-L','Black','#242021','L',2),
  ('3303','3303-ROS-M','Dusty Rose','#b97c87','M',3), ('3303','3303-OAT-L','Oat','#ded0bb','L',2), ('3303','3303-COC-XL','Cocoa','#6f5145','XL',2)
) as v(code,sku,color,color_hex,size,stock) on p.code = v.code
on conflict (sku) do update set color = excluded.color, color_hex = excluded.color_hex, size = excluded.size;

insert into public.shipping_services (courier_code, courier_name, service_code, service_name, flat_price, eta, enabled, source)
values ('jne','JNE','reg','REG',18000,'2-3 hari kerja',true,'manual'), ('jnt','J&T','ez','EZ',16000,'2-3 hari kerja',true,'manual'), ('sicepat','SiCepat','reg','REG',15000,'2-4 hari kerja',true,'manual')
on conflict (courier_code, service_code) do update set courier_name = excluded.courier_name, service_name = excluded.service_name, flat_price = excluded.flat_price, eta = excluded.eta;

insert into public.payment_methods (type, name, bank_code, account_number, account_holder, qris_payload, instructions, enabled, sort_order)
values
  ('bank_transfer','BCA','bca',null,'ANGGI ATELIER',null,'Isi nomor rekening dari menu Payment sebelum live.',false,10),
  ('bank_transfer','Blu BCA Digital','blu-bca',null,'ANGGI ATELIER',null,'Isi nomor rekening dari menu Payment sebelum live.',false,20),
  ('bank_transfer','SeaBank','seabank',null,'ANGGI ATELIER',null,'Isi nomor rekening dari menu Payment sebelum live.',false,30),
  ('qris','QRIS Dinamis',null,null,'iPhone Haven','00020101021126610014COM.GO-JEK.WWW01189360091436762029880210G6762029880303UMI51440014ID.CO.QRIS.WWW0215ID10254004132540303UMI5204573253033605802ID5912iPhone Haven6013JAKARTA TIMUR61051341062070703A016304F93B','QRIS otomatis mengikuti total produk dan ongkir.',true,40)
on conflict (name) do update set
  type = excluded.type,
  bank_code = excluded.bank_code,
  account_number = coalesce(public.payment_methods.account_number, excluded.account_number),
  account_holder = coalesce(public.payment_methods.account_holder, excluded.account_holder),
  qris_payload = coalesce(public.payment_methods.qris_payload, excluded.qris_payload),
  instructions = excluded.instructions,
  enabled = case
    when excluded.type = 'bank_transfer'
      and coalesce(btrim(public.payment_methods.account_number), '') <> ''
      and public.payment_methods.account_number <> '1234567890'
      then public.payment_methods.enabled
    else excluded.enabled
  end,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.payment_methods
set name = 'SeaBank', bank_code = 'seabank', updated_at = now()
where lower(name) like '%shield%';

select public.refresh_product_totals(id) from public.products;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('product-images', 'product-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
