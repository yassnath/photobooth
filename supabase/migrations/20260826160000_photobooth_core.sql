create table if not exists public.admins (
  id text primary key,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  active smallint not null default 1 check (active in (0, 1)),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.admin_sessions (
  id text primary key,
  admin_id text not null references public.admins(id) on delete cascade,
  token_hash text not null unique,
  created_at bigint not null,
  last_seen_at bigint not null,
  expires_at bigint not null
);

create table if not exists public.settings (
  key text primary key,
  value_json jsonb not null,
  updated_at bigint not null
);

create table if not exists public.vouchers (
  id text primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value integer not null,
  max_uses integer,
  used_count integer not null default 0,
  starts_at bigint,
  expires_at bigint,
  active smallint not null default 1 check (active in (0, 1)),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.payments (
  id text primary key,
  order_id text not null unique,
  provider text not null,
  method text not null,
  status text not null,
  base_amount integer not null,
  discount_amount integer not null default 0,
  amount integer not null,
  voucher_id text references public.vouchers(id) on delete set null,
  provider_transaction_id text,
  qr_string text,
  qr_url text,
  raw_json jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  expires_at bigint not null,
  paid_at bigint
);

create table if not exists public.voucher_redemptions (
  id text primary key,
  voucher_id text not null references public.vouchers(id) on delete cascade,
  payment_id text not null unique references public.payments(id) on delete cascade,
  status text not null check (status in ('reserved', 'redeemed', 'released')),
  created_at bigint not null,
  redeemed_at bigint
);

create table if not exists public.photo_sessions (
  id text primary key,
  mode text not null,
  template_id text not null,
  frame_layout text,
  result_format text,
  payment_id text unique references public.payments(id) on delete set null,
  consent_json jsonb,
  editor_json jsonb,
  created_at bigint not null,
  expires_at bigint not null
);

create table if not exists public.media_assets (
  id text primary key,
  session_id text not null references public.photo_sessions(id) on delete cascade,
  result_token text unique,
  kind text not null check (kind in ('raw', 'result')),
  format text,
  object_key text not null unique,
  mime_type text not null,
  extension text not null,
  size_bytes bigint not null,
  created_at bigint not null,
  expires_at bigint not null
);

create table if not exists public.booths (
  id text primary key,
  name text not null,
  token_hash text,
  last_seen_at bigint,
  status_json jsonb not null default '{}'::jsonb,
  version text,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_admin_sessions_token on public.admin_sessions(token_hash);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_media_assets_expiry on public.media_assets(expires_at);
create index if not exists idx_photo_sessions_created on public.photo_sessions(created_at desc);

alter table public.admins enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.settings enable row level security;
alter table public.vouchers enable row level security;
alter table public.payments enable row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.photo_sessions enable row level security;
alter table public.media_assets enable row level security;
alter table public.booths enable row level security;

revoke all on table public.admins from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
revoke all on table public.settings from anon, authenticated;
revoke all on table public.vouchers from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.voucher_redemptions from anon, authenticated;
revoke all on table public.photo_sessions from anon, authenticated;
revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.booths from anon, authenticated;
