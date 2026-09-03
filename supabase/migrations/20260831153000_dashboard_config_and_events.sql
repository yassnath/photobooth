create table if not exists public.theme_profiles (
  id text primary key,
  name text not null,
  theme_json jsonb not null,
  active smallint not null default 0 check (active in (0, 1)),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.filter_presets (
  id text primary key,
  label text not null,
  css text not null,
  source text,
  sort_order integer not null default 0,
  active smallint not null default 1 check (active in (0, 1)),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.frame_designs (
  id text primary key,
  label text not null,
  category text not null,
  color text not null,
  accent text not null,
  emoji text not null,
  overlay_image text,
  layout text,
  chroma_key_green smallint not null default 0 check (chroma_key_green in (0, 1)),
  slots_json jsonb,
  sort_order integer not null default 0,
  active smallint not null default 1 check (active in (0, 1)),
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.admin_audit_logs (
  id text primary key,
  admin_id text references public.admins(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata_json jsonb,
  created_at bigint not null
);

create table if not exists public.booth_events (
  id text primary key,
  booth_id text references public.booths(id) on delete cascade,
  level text not null,
  event_type text not null,
  message text not null,
  metadata_json jsonb,
  created_at bigint not null
);

create unique index if not exists idx_theme_profiles_one_active on public.theme_profiles((active)) where active = 1;
create index if not exists idx_filter_presets_order on public.filter_presets(active, sort_order, label);
create index if not exists idx_frame_designs_order on public.frame_designs(active, sort_order, label);
create index if not exists idx_admin_audit_created on public.admin_audit_logs(created_at desc);
create index if not exists idx_booth_events_created on public.booth_events(created_at desc);

alter table public.theme_profiles enable row level security;
alter table public.filter_presets enable row level security;
alter table public.frame_designs enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.booth_events enable row level security;

revoke all on table public.theme_profiles from anon, authenticated;
revoke all on table public.filter_presets from anon, authenticated;
revoke all on table public.frame_designs from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;
revoke all on table public.booth_events from anon, authenticated;

with normalized_theme as (
  select case
    when jsonb_typeof(value_json) = 'string' then (value_json #>> '{}')::jsonb
    else value_json
  end as theme_json
  from public.settings
  where key = 'theme'
  limit 1
)
insert into public.theme_profiles (id, name, theme_json, active, created_at, updated_at)
select
  'theme_active',
  coalesce(theme_json ->> 'brandName', 'Default Theme'),
  theme_json,
  1,
  extract(epoch from clock_timestamp())::bigint * 1000,
  extract(epoch from clock_timestamp())::bigint * 1000
from normalized_theme
where not exists (select 1 from public.theme_profiles where active = 1)
on conflict (id) do nothing;

with normalized_filters as (
  select case
    when jsonb_typeof(value_json) = 'string' then (value_json #>> '{}')::jsonb
    else value_json
  end as value_json
  from public.settings
  where key = 'filters'
  limit 1
),
filter_items as (
  select value, ordinality - 1 as sort_order
  from normalized_filters,
  lateral jsonb_array_elements(
    case
      when jsonb_typeof(value_json) = 'array' then value_json
      when jsonb_typeof(value_json -> 'filters') = 'array' then value_json -> 'filters'
      else '[]'::jsonb
    end
  ) with ordinality
)
insert into public.filter_presets (id, label, css, source, sort_order, active, created_at, updated_at)
select
  coalesce(value ->> 'id', 'filter_' || md5(value::text)),
  coalesce(value ->> 'label', 'Filter'),
  coalesce(value ->> 'css', ''),
  value ->> 'source',
  sort_order,
  1,
  extract(epoch from clock_timestamp())::bigint * 1000,
  extract(epoch from clock_timestamp())::bigint * 1000
from filter_items
where not exists (select 1 from public.filter_presets)
on conflict (id) do nothing;

with normalized_frames as (
  select case
    when jsonb_typeof(value_json) = 'string' then (value_json #>> '{}')::jsonb
    else value_json
  end as value_json
  from public.settings
  where key = 'frames'
  limit 1
),
frame_items as (
  select value, ordinality - 1 as sort_order
  from normalized_frames,
  lateral jsonb_array_elements(
    case
      when jsonb_typeof(value_json) = 'array' then value_json
      when jsonb_typeof(value_json -> 'frames') = 'array' then value_json -> 'frames'
      else '[]'::jsonb
    end
  ) with ordinality
)
insert into public.frame_designs (
  id, label, category, color, accent, emoji, overlay_image, layout,
  chroma_key_green, slots_json, sort_order, active, created_at, updated_at
)
select
  coalesce(value ->> 'id', 'frame_' || md5(value::text)),
  coalesce(value ->> 'label', 'Frame'),
  coalesce(value ->> 'category', 'Custom'),
  coalesce(value ->> 'color', '#ffffff'),
  coalesce(value ->> 'accent', '#ec4899'),
  coalesce(value ->> 'emoji', '✨'),
  value ->> 'overlayImage',
  value ->> 'layout',
  case when coalesce((value ->> 'chromaKeyGreen')::boolean, false) then 1 else 0 end,
  value -> 'slots',
  sort_order,
  1,
  extract(epoch from clock_timestamp())::bigint * 1000,
  extract(epoch from clock_timestamp())::bigint * 1000
from frame_items
where not exists (select 1 from public.frame_designs)
on conflict (id) do nothing;
