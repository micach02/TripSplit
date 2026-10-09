-- =============================================================================
-- TripSplit · Core schema
--
-- Tables, types and data-integrity triggers. Row Level Security is in the next
-- migration; storage buckets are in their own migrations.
--
-- Isolation: TripSplit can share a Supabase project with another app, so it
-- owns two schemas and touches nothing else:
--   tripsplit          tables, views and RPCs exposed through the Data API
--   tripsplit_private  helpers and trigger functions (never exposed)
-- There are deliberately NO triggers on auth.users: a broken trigger there
-- would block sign-ups for every app in the project. Profiles are created on
-- first use by tripsplit.ensure_profile() instead.
--
-- Conventions
--   * Money is numeric(14,2); exchange rates are numeric(18,8). The app works
--     in integer minor units and only ever sends decimal strings.
--   * Integrity errors raised by triggers use errcode P0001 and a stable
--     snake_case message key (e.g. 'split_total_mismatch') that the frontend
--     maps to friendly copy. Raw database errors are never shown to users.
-- =============================================================================

create schema if not exists tripsplit;
create schema if not exists tripsplit_private;

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
create type tripsplit.trip_status as enum ('upcoming', 'active', 'completed');
create type tripsplit.member_role as enum ('owner', 'member');
create type tripsplit.invitation_status as enum ('pending', 'accepted', 'declined', 'expired');
create type tripsplit.split_type as enum ('equal', 'custom', 'percentage', 'shares');
create type tripsplit.payment_method as enum ('cash', 'bank_transfer', 'gcash', 'paypal', 'other');

-- -----------------------------------------------------------------------------
-- Currencies — reference data, mirrored in src/lib/currencies.ts
-- -----------------------------------------------------------------------------
create table tripsplit.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimals smallint not null check (decimals between 0 and 3)
);

comment on table tripsplit.currencies is 'Supported currencies. decimals = number of minor-unit digits (JPY/KRW have none).';

insert into tripsplit.currencies (code, name, symbol, decimals) values
  ('PHP', 'Philippine Peso', '₱', 2),
  ('SGD', 'Singapore Dollar', 'S$', 2),
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('JPY', 'Japanese Yen', '¥', 0),
  ('KRW', 'South Korean Won', '₩', 0),
  ('MYR', 'Malaysian Ringgit', 'RM', 2);

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create function tripsplit_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function tripsplit_private.currency_decimals(p_code text)
returns smallint
language sql
stable
set search_path = ''
as $$
  select c.decimals from tripsplit.currencies c where c.code = p_code;
$$;

-- Raises amount_precision when a value has more decimals than its currency allows.
create function tripsplit_private.assert_currency_precision(p_amount numeric, p_currency text)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_decimals smallint := tripsplit_private.currency_decimals(p_currency);
begin
  if v_decimals is not null and p_amount <> round(p_amount, v_decimals) then
    raise exception using
      errcode = 'P0001',
      message = 'amount_precision',
      detail = format('%s amounts allow at most %s decimal places.', p_currency, v_decimals);
  end if;
end;
$$;

-- =============================================================================
-- profiles — one row per person who has used TripSplit
-- =============================================================================
create table tripsplit.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  email text not null,
  avatar_url text,
  preferred_currency text not null default 'PHP' references tripsplit.currencies (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on tripsplit.profiles
  for each row execute function tripsplit_private.set_updated_at();

-- Returns the caller's profile, creating it on first use and keeping the email
-- in sync with auth. Safe to call on every app load.
create function tripsplit.ensure_profile()
returns tripsplit.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  v_name text;
  v_currency text;
  v_profile tripsplit.profiles;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select coalesce(u.email, ''), coalesce(u.raw_user_meta_data, '{}'::jsonb)
  into v_email, v_meta
  from auth.users u
  where u.id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select * into v_profile from tripsplit.profiles p where p.id = v_user_id;
  if found then
    if v_profile.email is distinct from v_email then
      update tripsplit.profiles set email = v_email where id = v_user_id
      returning * into v_profile;
    end if;
    return v_profile;
  end if;

  -- Another app in the project may store the name as `name` rather than `full_name`.
  v_name := coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Traveler'
  );

  select c.code into v_currency
  from tripsplit.currencies c
  where c.code = upper(v_meta ->> 'preferred_currency');

  insert into tripsplit.profiles (id, full_name, email, preferred_currency)
  values (v_user_id, left(v_name, 100), v_email, coalesce(v_currency, 'PHP'))
  on conflict (id) do nothing;

  select * into v_profile from tripsplit.profiles p where p.id = v_user_id;
  return v_profile;
end;
$$;

-- =============================================================================
-- trips
-- =============================================================================
create table tripsplit.trips (
  id uuid primary key default gen_random_uuid(),
  -- restrict: an account that owns trips cannot be deleted out from under the
  -- other travelers; ownership must be resolved first.
  owner_id uuid not null default auth.uid() references tripsplit.profiles (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  destination text check (char_length(destination) <= 120),
  description text check (char_length(description) <= 2000),
  start_date date not null,
  end_date date not null,
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  currency text not null default 'PHP' references tripsplit.currencies (code),
  cover_image_url text,
  status tripsplit.trip_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_end_after_start check (end_date >= start_date)
);

create index trips_owner_id_idx on tripsplit.trips (owner_id);

create trigger trips_set_updated_at
  before update on tripsplit.trips
  for each row execute function tripsplit_private.set_updated_at();

-- =============================================================================
-- trip_members
-- =============================================================================
create table tripsplit.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  user_id uuid not null references tripsplit.profiles (id) on delete cascade,
  role tripsplit.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  constraint trip_members_trip_user_key unique (trip_id, user_id)
);

create index trip_members_user_id_idx on tripsplit.trip_members (user_id);
create unique index trip_members_one_owner_idx on tripsplit.trip_members (trip_id) where role = 'owner';

-- =============================================================================
-- trip_invitations
-- =============================================================================
create table tripsplit.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  invited_email text not null check (invited_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_by uuid not null default auth.uid() references tripsplit.profiles (id) on delete cascade,
  status tripsplit.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index trip_invitations_trip_id_idx on tripsplit.trip_invitations (trip_id);
create index trip_invitations_invited_by_idx on tripsplit.trip_invitations (invited_by);
create index trip_invitations_email_pending_idx on tripsplit.trip_invitations (invited_email) where status = 'pending';
create unique index trip_invitations_one_pending_idx on tripsplit.trip_invitations (trip_id, invited_email) where status = 'pending';

create function tripsplit_private.trip_invitations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.invited_email := lower(btrim(new.invited_email));

  if exists (
    select 1
    from tripsplit.trip_members m
    join tripsplit.profiles p on p.id = m.user_id
    where m.trip_id = new.trip_id and lower(p.email) = new.invited_email
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;

  -- A lapsed pending invitation must not block a fresh one.
  update tripsplit.trip_invitations
  set status = 'expired'
  where trip_id = new.trip_id
    and invited_email = new.invited_email
    and status = 'pending'
    and expires_at <= now();

  return new;
end;
$$;

create trigger trip_invitations_before_insert
  before insert on tripsplit.trip_invitations
  for each row execute function tripsplit_private.trip_invitations_before_insert();

-- =============================================================================
-- categories
-- =============================================================================
create table tripsplit.categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default '🏷️' check (char_length(icon) between 1 and 16),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_default boolean not null default false,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  -- Lets expenses/budgets reference (category, trip) so a category can never
  -- be attached to an expense from another trip.
  constraint categories_id_trip_key unique (id, trip_id)
);

create unique index categories_trip_name_key on tripsplit.categories (trip_id, lower(name));

-- =============================================================================
-- New trip → owner membership + default categories
-- =============================================================================
create function tripsplit_private.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into tripsplit.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into tripsplit.categories (trip_id, name, icon, color, is_default, sort_order)
  select new.id, d.name, d.icon, d.color, true, d.sort_order
  from (values
    ('Food',           '🍜', '#f97316', 1),
    ('Transportation', '🚕', '#0ea5e9', 2),
    ('Accommodation',  '🏨', '#8b5cf6', 3),
    ('Flights',        '✈️', '#3b82f6', 4),
    ('Activities',     '🎢', '#ec4899', 5),
    ('Shopping',       '🛍️', '#d946ef', 6),
    ('Entertainment',  '🎭', '#f43f5e', 7),
    ('Tickets',        '🎟️', '#14b8a6', 8),
    ('Drinks',         '🍹', '#eab308', 9),
    ('Groceries',      '🛒', '#22c55e', 10),
    ('Visa',           '🛂', '#6366f1', 11),
    ('Insurance',      '🛡️', '#0d9488', 12),
    ('Other',          '📦', '#64748b', 99)
  ) as d(name, icon, color, sort_order);

  return new;
end;
$$;

create trigger trips_after_insert
  after insert on tripsplit.trips
  for each row execute function tripsplit_private.handle_new_trip();

-- =============================================================================
-- expenses
-- =============================================================================
create table tripsplit.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  category_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  -- Original amount, in the expense currency
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null references tripsplit.currencies (code),
  -- Trip-currency units per 1 unit of expense currency (1 when currencies match)
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  -- amount × exchange_rate in the trip currency. Always computed by trigger.
  converted_amount numeric(14, 2) not null check (converted_amount > 0),
  paid_by uuid not null references tripsplit.profiles (id),
  expense_date date not null default current_date,
  notes text check (char_length(notes) <= 1000),
  -- Storage object path of the receipt (bucket is private; the app signs URLs)
  receipt_url text,
  created_by uuid default auth.uid() references tripsplit.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_category_fkey foreign key (category_id, trip_id)
    references tripsplit.categories (id, trip_id)
);

create index expenses_trip_date_idx on tripsplit.expenses (trip_id, expense_date desc, created_at desc);
create index expenses_category_id_idx on tripsplit.expenses (category_id);
create index expenses_paid_by_idx on tripsplit.expenses (paid_by);
create index expenses_created_by_idx on tripsplit.expenses (created_by);

create trigger expenses_set_updated_at
  before update on tripsplit.expenses
  for each row execute function tripsplit_private.set_updated_at();

create function tripsplit_private.expenses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_currency text;
begin
  select t.currency into v_trip_currency from tripsplit.trips t where t.id = new.trip_id;
  if v_trip_currency is null then
    raise exception using errcode = 'P0001', message = 'trip_not_found';
  end if;

  perform tripsplit_private.assert_currency_precision(new.amount, new.currency);

  if new.currency = v_trip_currency then
    new.exchange_rate := 1;
  end if;

  new.converted_amount := round(new.amount * new.exchange_rate, tripsplit_private.currency_decimals(v_trip_currency));

  if tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by then
    if not exists (
      select 1 from tripsplit.trip_members m
      where m.trip_id = new.trip_id and m.user_id = new.paid_by
    ) then
      raise exception using errcode = 'P0001', message = 'payer_not_member';
    end if;
  end if;

  return new;
end;
$$;

create trigger expenses_before_write
  before insert or update on tripsplit.expenses
  for each row execute function tripsplit_private.expenses_before_write();

-- =============================================================================
-- expense_splits
-- =============================================================================
create table tripsplit.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references tripsplit.expenses (id) on delete cascade,
  user_id uuid not null references tripsplit.profiles (id),
  split_type tripsplit.split_type not null,
  -- The participant's input: null for equal, an amount in the expense
  -- currency for custom, 0–100 for percentage, a weight for shares.
  value numeric(14, 4) check (value >= 0),
  -- The participant's share in the trip currency. Shares sum to converted_amount.
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  constraint expense_splits_expense_user_key unique (expense_id, user_id),
  constraint expense_splits_value_required check (split_type = 'equal' or value is not null),
  constraint expense_splits_percentage_range check (split_type <> 'percentage' or value <= 100)
);

create index expense_splits_user_id_idx on tripsplit.expense_splits (user_id);

create function tripsplit_private.expense_splits_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_trip_currency text;
begin
  select e.trip_id, t.currency into v_trip_id, v_trip_currency
  from tripsplit.expenses e
  join tripsplit.trips t on t.id = e.trip_id
  where e.id = new.expense_id;

  perform tripsplit_private.assert_currency_precision(new.amount, v_trip_currency);

  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    if not exists (
      select 1 from tripsplit.trip_members m
      where m.trip_id = v_trip_id and m.user_id = new.user_id
    ) then
      raise exception using errcode = 'P0001', message = 'participant_not_member';
    end if;
  end if;

  return new;
end;
$$;

create trigger expense_splits_before_write
  before insert or update on tripsplit.expense_splits
  for each row execute function tripsplit_private.expense_splits_before_write();

-- Every expense must have at least one participant and its shares must add up
-- to exactly converted_amount. Checked at COMMIT so an expense and its splits
-- can be written together in one transaction (see the save-expense RPC).
create function tripsplit_private.check_expense_split_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_converted numeric;
  v_total numeric;
  v_count integer;
begin
  if tg_table_name = 'expenses' then
    v_expense_id := new.id;
  elsif tg_op = 'DELETE' then
    v_expense_id := old.expense_id;
  else
    v_expense_id := new.expense_id;
  end if;

  select e.converted_amount into v_converted from tripsplit.expenses e where e.id = v_expense_id;
  if not found then
    return null; -- the expense itself was deleted
  end if;

  select coalesce(sum(s.amount), 0), count(*) into v_total, v_count
  from tripsplit.expense_splits s
  where s.expense_id = v_expense_id;

  if v_count = 0 then
    raise exception using errcode = 'P0001', message = 'expense_requires_participant';
  end if;

  if v_total <> v_converted then
    raise exception using
      errcode = 'P0001',
      message = 'split_total_mismatch',
      detail = format('Shares total %s but the expense is %s.', v_total, v_converted);
  end if;

  return null;
end;
$$;

create constraint trigger expenses_split_total_check
  after insert or update on tripsplit.expenses
  deferrable initially deferred
  for each row execute function tripsplit_private.check_expense_split_total();

create constraint trigger expense_splits_total_check
  after insert or update or delete on tripsplit.expense_splits
  deferrable initially deferred
  for each row execute function tripsplit_private.check_expense_split_total();

-- =============================================================================
-- settlements
-- =============================================================================
create table tripsplit.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  from_user_id uuid not null references tripsplit.profiles (id),
  to_user_id uuid not null references tripsplit.profiles (id),
  amount numeric(14, 2) not null check (amount > 0),
  -- Always the trip currency (set by trigger)
  currency text not null references tripsplit.currencies (code),
  payment_method tripsplit.payment_method not null default 'cash',
  settlement_date date not null default current_date,
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references tripsplit.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint settlements_distinct_parties check (from_user_id <> to_user_id)
);

create index settlements_trip_date_idx on tripsplit.settlements (trip_id, settlement_date desc, created_at desc);
create index settlements_from_user_id_idx on tripsplit.settlements (from_user_id);
create index settlements_to_user_id_idx on tripsplit.settlements (to_user_id);
create index settlements_created_by_idx on tripsplit.settlements (created_by);

create function tripsplit_private.settlements_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_currency text;
begin
  select t.currency into v_trip_currency from tripsplit.trips t where t.id = new.trip_id;
  if v_trip_currency is null then
    raise exception using errcode = 'P0001', message = 'trip_not_found';
  end if;

  new.currency := v_trip_currency;
  perform tripsplit_private.assert_currency_precision(new.amount, v_trip_currency);

  if tg_op = 'INSERT'
     or new.from_user_id is distinct from old.from_user_id
     or new.to_user_id is distinct from old.to_user_id then
    if (
      select count(*) from tripsplit.trip_members m
      where m.trip_id = new.trip_id and m.user_id in (new.from_user_id, new.to_user_id)
    ) <> 2 then
      raise exception using errcode = 'P0001', message = 'settlement_party_not_member';
    end if;
  end if;

  return new;
end;
$$;

create trigger settlements_before_write
  before insert or update on tripsplit.settlements
  for each row execute function tripsplit_private.settlements_before_write();

-- =============================================================================
-- budget_categories — planned spend per category
-- =============================================================================
create table tripsplit.budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  category_id uuid not null,
  planned_amount numeric(14, 2) not null check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_categories_trip_category_key unique (trip_id, category_id),
  constraint budget_categories_category_fkey foreign key (category_id, trip_id)
    references tripsplit.categories (id, trip_id) on delete cascade
);

create trigger budget_categories_set_updated_at
  before update on tripsplit.budget_categories
  for each row execute function tripsplit_private.set_updated_at();

-- =============================================================================
-- Trip currency is locked once money has been recorded against it
-- =============================================================================
create function tripsplit_private.trips_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency and (
    exists (select 1 from tripsplit.expenses e where e.trip_id = new.id)
    or exists (select 1 from tripsplit.settlements s where s.trip_id = new.id)
  ) then
    raise exception using errcode = 'P0001', message = 'trip_currency_locked';
  end if;

  return new;
end;
$$;

create trigger trips_before_update
  before update on tripsplit.trips
  for each row execute function tripsplit_private.trips_before_update();

-- =============================================================================
-- trip_totals — spend per trip, aggregated in the database.
-- security_invoker: callers only see totals for trips their RLS allows.
-- =============================================================================
create view tripsplit.trip_totals
with (security_invoker = true)
as
select
  t.id as trip_id,
  coalesce(sum(e.converted_amount), 0)::numeric(14, 2) as total_spent,
  count(e.id)::integer as expense_count
from tripsplit.trips t
left join tripsplit.expenses e on e.trip_id = t.id
group by t.id;
