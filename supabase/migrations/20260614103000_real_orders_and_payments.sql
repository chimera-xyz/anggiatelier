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

alter table public.orders add column if not exists payment_method_id uuid references public.payment_methods(id);
alter table public.orders add column if not exists payment_details jsonb not null default '{}'::jsonb;

create index if not exists payment_methods_enabled_idx on public.payment_methods (enabled, sort_order);
alter table public.payment_methods enable row level security;

drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods"
on public.payment_methods for select to anon using (enabled = true);

insert into public.payment_methods (
  type, name, bank_code, account_number, account_holder, qris_payload,
  instructions, enabled, sort_order
)
values
  ('bank_transfer','BCA','bca','1234567890','ANGGI ATELIER',null,'Transfer sesuai total order, lalu kirim bukti pembayaran.',true,10),
  ('bank_transfer','Blu BCA Digital','blu-bca',null,'ANGGI ATELIER',null,'Isi nomor rekening dari menu Payment sebelum live.',true,20),
  ('bank_transfer','SeaBank','seabank',null,'ANGGI ATELIER',null,'Isi nomor rekening dari menu Payment sebelum live.',true,30),
  ('qris','QRIS Dinamis',null,null,null,'00020101021126610014COM.GO-JEK.WWW01189360091436762029880210G6762029880303UMI51440014ID.CO.QRIS.WWW0215ID10254004132540303UMI5204573253033605802ID5912iPhone Haven6013JAKARTA TIMUR61051341062070703A016304F93B','QRIS otomatis mengikuti total produk dan ongkir.',true,40)
on conflict (name) do update set
  type = excluded.type,
  bank_code = excluded.bank_code,
  account_number = coalesce(public.payment_methods.account_number, excluded.account_number),
  account_holder = coalesce(public.payment_methods.account_holder, excluded.account_holder),
  qris_payload = coalesce(public.payment_methods.qris_payload, excluded.qris_payload),
  instructions = excluded.instructions,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.payment_methods
set name = 'SeaBank', bank_code = 'seabank', updated_at = now()
where lower(name) like '%shield%';

create or replace function public.make_order_number(p_source public.order_source)
returns text language sql volatile set search_path = public as $$
  select (case when p_source = 'website' then 'WEB' else 'WA' end)
    || '-' || to_char(clock_timestamp(), 'DDMMYY-HH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;
