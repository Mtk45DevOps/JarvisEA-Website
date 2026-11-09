create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  service_ids text[] not null,
  services jsonb not null,
  amount_cents integer not null check (amount_cents >= 200),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  status text not null default 'pending' check (status in ('pending','paid','failed','checkout_error')),
  yoco_checkout_id text unique,
  yoco_payment_id text,
  paid_at timestamptz,
  owner_notified_at timestamptz,
  customer_notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

-- No anon/authenticated policies are created. Only the server-side service-role key
-- used by Vercel functions can read/write order records. Never expose that key in browser code.