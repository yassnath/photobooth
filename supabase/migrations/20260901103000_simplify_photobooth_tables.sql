create table if not exists public.orders (
  id text primary key,
  code text not null unique,
  provider text not null,
  method text not null,
  status text not null check (status in ('pending', 'paid', 'expired', 'failed')),
  base_amount integer not null,
  discount_amount integer not null default 0,
  total_amount integer not null,
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

do $$
begin
  if to_regclass('public.payments') is not null then
    execute $sql$
      insert into public.orders (
        id, code, provider, method, status, base_amount, discount_amount, total_amount,
        voucher_id, provider_transaction_id, qr_string, qr_url, raw_json, created_at,
        updated_at, expires_at, paid_at
      )
      select
        id, order_id, provider, method, status, base_amount, discount_amount, amount,
        voucher_id, provider_transaction_id, qr_string, qr_url, raw_json, created_at,
        updated_at, expires_at, paid_at
      from public.payments
      on conflict (id) do update set
        code = excluded.code,
        provider = excluded.provider,
        method = excluded.method,
        status = excluded.status,
        base_amount = excluded.base_amount,
        discount_amount = excluded.discount_amount,
        total_amount = excluded.total_amount,
        voucher_id = excluded.voucher_id,
        provider_transaction_id = excluded.provider_transaction_id,
        qr_string = excluded.qr_string,
        qr_url = excluded.qr_url,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at,
        paid_at = excluded.paid_at
    $sql$;
  end if;
end $$;

create table if not exists public.sessions (
  id text primary key,
  mode text not null,
  template_id text not null,
  frame_layout text,
  result_format text,
  order_id text unique references public.orders(id) on delete set null,
  consent_json jsonb,
  editor_json jsonb,
  created_at bigint not null,
  expires_at bigint not null
);

do $$
begin
  if to_regclass('public.photo_sessions') is not null then
    execute $sql$
      insert into public.sessions (
        id, mode, template_id, frame_layout, result_format, order_id,
        consent_json, editor_json, created_at, expires_at
      )
      select
        id, mode, template_id, frame_layout, result_format, payment_id,
        consent_json, editor_json, created_at, expires_at
      from public.photo_sessions
      on conflict (id) do update set
        mode = excluded.mode,
        template_id = excluded.template_id,
        frame_layout = excluded.frame_layout,
        result_format = excluded.result_format,
        order_id = excluded.order_id,
        consent_json = excluded.consent_json,
        editor_json = excluded.editor_json,
        expires_at = excluded.expires_at
    $sql$;
  end if;
end $$;

create table if not exists public.photos (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
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

do $$
begin
  if to_regclass('public.media_assets') is not null then
    execute $sql$
      insert into public.photos (
        id, session_id, result_token, kind, format, object_key, mime_type,
        extension, size_bytes, created_at, expires_at
      )
      select
        id, session_id, result_token, kind, format, object_key, mime_type,
        extension, size_bytes, created_at, expires_at
      from public.media_assets
      on conflict (id) do update set
        session_id = excluded.session_id,
        result_token = excluded.result_token,
        kind = excluded.kind,
        format = excluded.format,
        object_key = excluded.object_key,
        mime_type = excluded.mime_type,
        extension = excluded.extension,
        size_bytes = excluded.size_bytes,
        expires_at = excluded.expires_at
    $sql$;
  end if;
end $$;

create table if not exists public.logs (
  id text primary key,
  source text not null check (source in ('admin', 'booth', 'system')),
  level text not null default 'info',
  event_type text not null,
  admin_id text references public.admins(id) on delete set null,
  booth_id text references public.booths(id) on delete set null,
  entity_type text,
  entity_id text,
  message text,
  metadata_json jsonb,
  created_at bigint not null
);

do $$
begin
  if to_regclass('public.admin_audit_logs') is not null then
    execute $sql$
      insert into public.logs (id, source, level, event_type, admin_id, entity_type, entity_id, metadata_json, created_at)
      select id, 'admin', 'info', action, admin_id, entity_type, entity_id, metadata_json, created_at
      from public.admin_audit_logs
      on conflict (id) do nothing
    $sql$;
  end if;

  if to_regclass('public.booth_events') is not null then
    execute $sql$
      insert into public.logs (id, source, level, event_type, booth_id, message, metadata_json, created_at)
      select id, 'booth', level, event_type, booth_id, message, metadata_json, created_at
      from public.booth_events
      on conflict (id) do nothing
    $sql$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.theme_profiles') is not null then
    execute $sql$
      insert into public.settings (key, value_json, updated_at)
      select 'theme', theme_json, updated_at
      from public.theme_profiles
      where active = 1
      order by updated_at desc
      limit 1
      on conflict (key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    $sql$;
  end if;

  if to_regclass('public.filter_presets') is not null then
    execute $sql$
      insert into public.settings (key, value_json, updated_at)
      select
        'filters',
        coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'label', label,
          'css', css,
          'source', source,
          'createdAt', to_jsonb(to_timestamp(created_at / 1000.0))
        )) order by sort_order, label), '[]'::jsonb),
        coalesce(max(updated_at), extract(epoch from clock_timestamp())::bigint * 1000)
      from public.filter_presets
      where active = 1
      on conflict (key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    $sql$;
  end if;

  if to_regclass('public.frame_designs') is not null then
    execute $sql$
      insert into public.settings (key, value_json, updated_at)
      select
        'frames',
        coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', id,
          'label', label,
          'category', category,
          'color', color,
          'accent', accent,
          'emoji', emoji,
          'overlayImage', overlay_image,
          'layout', layout,
          'chromaKeyGreen', chroma_key_green = 1,
          'slots', slots_json
        )) order by sort_order, label), '[]'::jsonb),
        coalesce(max(updated_at), extract(epoch from clock_timestamp())::bigint * 1000)
      from public.frame_designs
      where active = 1
      on conflict (key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    $sql$;
  end if;
end $$;

create index if not exists idx_orders_status on public.orders(status, created_at desc);
create index if not exists idx_orders_voucher on public.orders(voucher_id, status, expires_at);
create index if not exists idx_sessions_created on public.sessions(created_at desc);
create unique index if not exists idx_sessions_order on public.sessions(order_id) where order_id is not null;
create index if not exists idx_photos_expiry on public.photos(expires_at);
create index if not exists idx_logs_created on public.logs(created_at desc);

alter table public.orders enable row level security;
alter table public.sessions enable row level security;
alter table public.photos enable row level security;
alter table public.logs enable row level security;

revoke all on table public.orders from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.photos from anon, authenticated;
revoke all on table public.logs from anon, authenticated;

drop table if exists public.voucher_redemptions cascade;
drop table if exists public.media_assets cascade;
drop table if exists public.photo_sessions cascade;
drop table if exists public.payments cascade;
drop table if exists public.theme_profiles cascade;
drop table if exists public.filter_presets cascade;
drop table if exists public.frame_designs cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.booth_events cascade;
