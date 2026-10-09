-- =============================================================================
-- TripSplit · Development seed data — LOCAL ONLY (applied by `supabase db reset`)
--
-- Never push this to a hosted project: it creates auth accounts with a
-- published password, and a shared project's other apps would accept them.
--
-- Every account's password is:  tripsplit123
--
--   michael@tripsplit.dev  Michael Reyes  — owner of "Singapore Adventure"
--   john@tripsplit.dev     John Cruz      — member
--   sarah@tripsplit.dev    Sarah Lim      — member
--   anna@tripsplit.dev     Anna Tan       — member; owner of "Tokyo Cherry Blossoms"
--   paolo@tripsplit.dev    Paolo Garcia   — has a pending invite to Singapore
--
-- Singapore Adventure is always "in progress": it starts 3 days before the
-- seed runs. Spending ≈ ₱38,095.50 of a ₱50,000 budget (76% — past the 75%
-- warning). Tokyo Cherry Blossoms belongs to Anna & Sarah only, so Michael,
-- John and Paolo must never see it (handy for checking RLS by hand).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auth users + TripSplit profiles (the app normally creates profiles through
-- tripsplit.ensure_profile() on first sign-in)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('tripsplit123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'preferred_currency', 'PHP'),
  now() - interval '45 days',
  now(),
  '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'michael@tripsplit.dev', 'Michael Reyes'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'john@tripsplit.dev',    'John Cruz'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sarah@tripsplit.dev',   'Sarah Lim'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'anna@tripsplit.dev',    'Anna Tan'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'paolo@tripsplit.dev',   'Paolo Garcia')
) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  u.created_at,
  now()
from auth.users u
where u.email like '%@tripsplit.dev';

insert into tripsplit.profiles (id, full_name, email, preferred_currency, created_at)
select u.id, u.raw_user_meta_data ->> 'full_name', u.email, 'PHP', u.created_at
from auth.users u
where u.email like '%@tripsplit.dev';

-- -----------------------------------------------------------------------------
-- Trips, members, expenses, settlements, budgets.
-- One DO block = one transaction, so the deferred split-total checks run once
-- every expense has its splits.
-- -----------------------------------------------------------------------------
do $$
declare
  michael constant uuid := '11111111-1111-4111-8111-111111111111';
  john    constant uuid := '22222222-2222-4222-8222-222222222222';
  sarah   constant uuid := '33333333-3333-4333-8333-333333333333';
  anna    constant uuid := '44444444-4444-4444-8444-444444444444';

  sg      constant uuid := 'a1000000-0000-4000-8000-000000000001';
  tokyo   constant uuid := 'a1000000-0000-4000-8000-000000000002';
  day0    constant date := current_date - 3;

  c_food uuid;
  c_transport uuid;
  c_accommodation uuid;
  c_activities uuid;
  c_shopping uuid;
  c_emergency uuid;
  e uuid;
begin
  -- Singapore Adventure ------------------------------------------------------
  insert into tripsplit.trips (id, owner_id, name, destination, description, start_date, end_date, budget, currency, status, created_at)
  values (
    sg, michael, 'Singapore Adventure', 'Singapore',
    'Hawker centres, Universal Studios and Gardens by the Bay with the barkada.',
    day0, day0 + 5, 50000, 'PHP', 'active', now() - interval '30 days'
  );

  insert into tripsplit.trip_members (trip_id, user_id, role, joined_at) values
    (sg, john,  'member', now() - interval '29 days'),
    (sg, sarah, 'member', now() - interval '28 days'),
    (sg, anna,  'member', now() - interval '27 days');

  insert into tripsplit.categories (trip_id, name, icon, color, sort_order)
  values (sg, 'Emergency', '🚑', '#ef4444', 50)
  returning id into c_emergency;

  select id into c_food          from tripsplit.categories where trip_id = sg and name = 'Food';
  select id into c_transport     from tripsplit.categories where trip_id = sg and name = 'Transportation';
  select id into c_accommodation from tripsplit.categories where trip_id = sg and name = 'Accommodation';
  select id into c_activities    from tripsplit.categories where trip_id = sg and name = 'Activities';
  select id into c_shopping      from tripsplit.categories where trip_id = sg and name = 'Shopping';

  -- Hotel — ₱20,000, Michael paid, split equally
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, notes, created_by)
  values (sg, c_accommodation, 'Hotel — 5 nights in Bugis', 20000, 'PHP', michael, day0, 'Two twin rooms, booked online.', michael)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'equal', null, 5000), (e, john, 'equal', null, 5000),
    (e, sarah, 'equal', null, 5000), (e, anna, 'equal', null, 5000);

  -- Food — ₱2,500, Sarah paid, split equally
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, created_by)
  values (sg, c_food, 'Dinner at Lau Pa Sat', 2500, 'PHP', sarah, day0, sarah)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'equal', null, 625), (e, john, 'equal', null, 625),
    (e, sarah, 'equal', null, 625), (e, anna, 'equal', null, 625);

  -- Grab — ₱800, John paid, split equally
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, created_by)
  values (sg, c_transport, 'Grab to Gardens by the Bay', 800, 'PHP', john, day0 + 1, john)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'equal', null, 200), (e, john, 'equal', null, 200),
    (e, sarah, 'equal', null, 200), (e, anna, 'equal', null, 200);

  -- Universal Studios — ₱8,000, Michael paid, split equally
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, created_by)
  values (sg, c_activities, 'Universal Studios tickets', 8000, 'PHP', michael, day0 + 1, michael)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'equal', null, 2000), (e, john, 'equal', null, 2000),
    (e, sarah, 'equal', null, 2000), (e, anna, 'equal', null, 2000);

  -- Breakfast — S$24.60 @ 42.50 = ₱1,045.50, John paid, split by shares 2:1:1
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, exchange_rate, paid_by, expense_date, created_by)
  values (sg, c_food, 'Kaya toast breakfast', 24.60, 'SGD', 42.50, john, day0 + 2, john)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'shares', 2, 522.75), (e, john, 'shares', 1, 261.37), (e, sarah, 'shares', 1, 261.38);

  -- Cable car — ₱2,600, Sarah paid, split by percentage 40/20/20/20
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, created_by)
  values (sg, c_activities, 'Sentosa cable car', 2600, 'PHP', sarah, day0 + 2, sarah)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, michael, 'percentage', 40, 1040), (e, john, 'percentage', 20, 520),
    (e, sarah, 'percentage', 20, 520), (e, anna, 'percentage', 20, 520);

  -- Shopping — ₱3,150, Anna paid, custom split between Anna and Sarah
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by, expense_date, notes, created_by)
  values (sg, c_shopping, 'Shopping at Bugis Street', 3150, 'PHP', anna, day0 + 3, 'Souvenirs and shirts.', anna)
  returning id into e;
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount) values
    (e, anna, 'custom', 1800, 1800), (e, sarah, 'custom', 1350, 1350);

  -- John paid Michael back part of the hotel
  insert into tripsplit.settlements (trip_id, from_user_id, to_user_id, amount, currency, payment_method, settlement_date, note, created_by)
  values (sg, john, michael, 3000, 'PHP', 'gcash', day0 + 2, 'Partial payment for the hotel', john);

  insert into tripsplit.budget_categories (trip_id, category_id, planned_amount) values
    (sg, c_accommodation, 15000),
    (sg, c_food,           8000),
    (sg, c_transport,      5000),
    (sg, c_activities,    10000),
    (sg, c_shopping,       7000),
    (sg, c_emergency,      5000);

  insert into tripsplit.trip_invitations (trip_id, invited_email, invited_by, status, expires_at, created_at)
  values (sg, 'paolo@tripsplit.dev', michael, 'pending', now() + interval '6 days', now() - interval '1 day');

  -- Tokyo Cherry Blossoms (Anna & Sarah only) --------------------------------
  insert into tripsplit.trips (id, owner_id, name, destination, description, start_date, end_date, budget, currency, status)
  values (
    tokyo, anna, 'Tokyo Cherry Blossoms', 'Tokyo, Japan',
    'Hanami season — Ueno Park, Shinjuku Gyoen and too much ramen.',
    '2027-03-28', '2027-04-04', 250000, 'JPY', 'upcoming'
  );

  insert into tripsplit.trip_members (trip_id, user_id, role) values (tokyo, sarah, 'member');
end;
$$;
