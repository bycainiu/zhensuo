create table if not exists sources (
  id text primary key,
  kind text not null,
  name text not null,
  status text not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id text primary key,
  source_id text not null,
  title text not null,
  filename text not null,
  duration_sec real not null,
  width int not null,
  height int not null,
  poster_url text not null,
  status text not null default 'pending',
  path text not null,
  pick_code text,
  size_mb real not null default 0,
  frame_count int not null default 0,
  vector_count int not null default 0,
  indexed_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists frames (
  id text primary key,
  video_id text not null references videos(id) on delete cascade,
  timestamp_sec real not null,
  shot_id int not null default 0,
  still_url text not null,
  scene_tags jsonb not null default '[]'::jsonb,
  objects jsonb not null default '[]'::jsonb
);

create table if not exists regions (
  id text primary key,
  frame_id text not null references frames(id) on delete cascade,
  video_id text not null,
  view_type text not null,
  person_index int,
  bbox jsonb,
  attributes jsonb not null default '{}'::jsonb,
  vector jsonb not null
);

create index if not exists regions_video_idx on regions (video_id);
create index if not exists regions_view_idx on regions (view_type);
create index if not exists frames_video_idx on frames (video_id);

create table if not exists ingest_jobs (
  id text primary key,
  video_id text,
  source_id text not null,
  filename text not null default '',
  stage text not null default 'queued',
  progress real not null default 0,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists models (
  id text primary key,
  role text not null,
  name text not null,
  vendor text not null,
  dim int,
  languages jsonb not null default '[]'::jsonb,
  vram_gb real not null default 0,
  notes text not null default '',
  active boolean not null default false,
  chinese text not null default 'multi',
  action real not null default 0.7,
  expression real not null default 0.5,
  clothing real not null default 0.8,
  compound real not null default 0.6,
  config jsonb not null default '{}'::jsonb
);

create table if not exists searches (
  id text primary key,
  query text not null,
  parsed jsonb,
  model_id text,
  result_count int not null default 0,
  latency_ms int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists downstream_apps (
  id text primary key,
  name text not null,
  kind text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);
