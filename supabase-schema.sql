-- ============================================================
-- PracticePace — Supabase Schema
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";


-- ============================================================
-- TABLES
-- ============================================================

create table organizations (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  slug             text not null unique,
  sport            text not null,
  primary_color    text not null default '#000000',
  secondary_color  text not null default '#ffffff',
  logo_url         text,
  created_at       timestamptz not null default now()
);

create table subscriptions (
  id                       uuid primary key default uuid_generate_v4(),
  org_id                   uuid not null references organizations(id) on delete cascade,
  stripe_customer_id       text not null,
  stripe_subscription_id   text not null unique,
  status                   text not null check (status in ('trialing', 'active', 'canceled')),
  plan                     text not null check (plan in ('monthly', 'annual')),
  trial_ends_at            timestamptz,
  created_at               timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'coach', 'readonly')),
  full_name   text,
  created_at  timestamptz not null default now()
);

create table scripts (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  created_by  uuid not null references profiles(id) on delete set null,
  name        text not null,
  sport       text not null check (sport in ('football', 'basketball')),
  drills      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table backgrounds (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  type        text not null check (type in ('image', 'color', 'gradient')),
  value       text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index subscriptions_org_id_idx  on subscriptions(org_id);
create index profiles_org_id_idx       on profiles(org_id);
create index scripts_org_id_idx        on scripts(org_id);
create index scripts_created_by_idx    on scripts(created_by);
create index backgrounds_org_id_idx    on backgrounds(org_id);


-- ============================================================
-- AUTO-UPDATE updated_at ON scripts
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scripts_updated_at
  before update on scripts
  for each row execute procedure set_updated_at();


-- ============================================================
-- HELPER: get the org_id for the current authenticated user
-- Defined as security definer so RLS policies can call it
-- without causing infinite recursion on the profiles table.
-- ============================================================

create or replace function get_my_org_id()
returns uuid language sql security definer stable as $$
  select org_id from profiles where id = auth.uid();
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations  enable row level security;
alter table subscriptions  enable row level security;
alter table profiles       enable row level security;
alter table scripts        enable row level security;
alter table backgrounds    enable row level security;


-- organizations
create policy "org members can view their organization"
  on organizations for select
  using (id = get_my_org_id());

create policy "org admins can update their organization"
  on organizations for update
  using (id = get_my_org_id())
  with check (
    id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  );


-- subscriptions
create policy "org members can view their subscription"
  on subscriptions for select
  using (org_id = get_my_org_id());

create policy "org admins can manage their subscription"
  on subscriptions for all
  using (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  );


-- profiles
create policy "org members can view profiles in their org"
  on profiles for select
  using (org_id = get_my_org_id());

create policy "users can update their own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "org admins can manage profiles in their org"
  on profiles for all
  using (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  );


-- scripts
create policy "org members can view scripts"
  on scripts for select
  using (org_id = get_my_org_id());

create policy "coaches and admins can insert scripts"
  on scripts for insert
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) in ('admin', 'coach')
  );

create policy "coaches and admins can update scripts"
  on scripts for update
  using (org_id = get_my_org_id())
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) in ('admin', 'coach')
  );

create policy "coaches and admins can delete scripts"
  on scripts for delete
  using (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) in ('admin', 'coach')
  );


-- backgrounds
create policy "org members can view backgrounds"
  on backgrounds for select
  using (org_id = get_my_org_id());

create policy "org admins can manage backgrounds"
  on backgrounds for all
  using (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  )
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) = 'admin'
  );


-- ============================================================
-- ENFORCE SINGLE DEFAULT BACKGROUND PER ORG
-- ============================================================

create unique index backgrounds_one_default_per_org_idx
  on backgrounds(org_id)
  where is_default = true;


-- ============================================================
-- ADDITIONS — run these ALTER / CREATE statements on an
-- existing database to bring it up to date.
-- ============================================================

-- 1. Add background_url to organizations
alter table organizations
  add column if not exists background_url text;

-- 2. Widen the scripts sport check to all supported sports
alter table scripts
  drop constraint if exists scripts_sport_check;
alter table scripts
  add constraint scripts_sport_check
  check (sport in (
    'football','basketball','volleyball','baseball',
    'softball','soccer','track','wrestling','tennis','other'
  ));

-- 3. Videos table
create table if not exists videos (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  title       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists videos_org_id_idx on videos(org_id);

alter table videos enable row level security;

create policy "org members can view videos"
  on videos for select
  using (org_id = get_my_org_id());

create policy "coaches and admins can insert videos"
  on videos for insert
  with check (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) in ('admin', 'coach')
  );

create policy "coaches and admins can delete videos"
  on videos for delete
  using (
    org_id = get_my_org_id()
    and (select role from profiles where id = auth.uid()) in ('admin', 'coach')
  );

-- 4. Coach invites table (for the invite-coach flow)
create table if not exists coach_invites (
  id         uuid primary key default uuid_generate_v4(),
  org_id     uuid not null references organizations(id) on delete cascade,
  email      text not null,
  name       text,
  role       text not null default 'coach' check (role in ('admin','coach','readonly')),
  created_at timestamptz not null default now()
);

alter table coach_invites enable row level security;

create policy "org admins can manage invites"
  on coach_invites for all
  using  (org_id = get_my_org_id() and (select role from profiles where id = auth.uid()) = 'admin')
  with check (org_id = get_my_org_id() and (select role from profiles where id = auth.uid()) = 'admin');

-- 5. Add created_by to videos (run if the videos table already exists)
alter table videos
  add column if not exists created_by uuid references profiles(id) on delete set null;
