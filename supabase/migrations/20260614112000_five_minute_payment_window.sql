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

update public.payment_methods
set account_holder = 'iPhone Haven', updated_at = now()
where type = 'qris' and coalesce(btrim(account_holder), '') = '';
