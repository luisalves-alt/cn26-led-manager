drop table if exists led_deliveries cascade;
drop table if exists led_assignments cascade;
drop table if exists led_tasks cascade;
drop table if exists led_periods cascade;
drop table if exists led_days cascade;
drop table if exists led_designers cascade;
drop table if exists led_events cascade;

create table led_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean default true,
  drive_folder_id text,
  created_at timestamptz default now()
);

create table led_designers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references led_events(id) on delete cascade,
  name text not null
);

create table led_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references led_events(id) on delete cascade,
  number integer not null,
  label text not null,
  drive_folder_id text
);

create table led_periods (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references led_days(id) on delete cascade,
  label text not null,
  order_index integer not null,
  drive_folder_id text,
  drive_image_folder_id text,
  drive_video_folder_id text
);

create table led_tasks (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references led_periods(id) on delete cascade,
  designer_id uuid references led_designers(id) on delete cascade,
  type text not null default 'image',
  name text not null,
  order_index integer not null,
  drive_folder_id text
);

create table led_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references led_tasks(id) on delete cascade,
  status text default 'pending',
  delivered_at timestamptz,
  approved_at timestamptz,
  revision_note text,
  created_at timestamptz default now()
);
