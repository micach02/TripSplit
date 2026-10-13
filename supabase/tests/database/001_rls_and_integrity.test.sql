-- =============================================================================
-- TripSplit · RLS & integrity tests (pgTAP)
--
--   local Docker:   npm run db:test          (pg_prove)
--   hosted project: npm run db:test:remote   (supabase db query --linked)
--
-- Every assertion runs inside one function. All changes — fixtures, and even
-- installing pgTAP — are rolled back by a deliberate exception at the end, and
-- the TAP lines come back as a single result set. Nothing is left behind, which
-- matters when the project is shared with another app.
--
-- Cast: owner (A) and members (B, D) of one trip, plus an outsider (C).
-- =============================================================================

-- Impersonate a signed-in user the same way PostgREST does.
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
declare
  v_email text;
begin
  perform set_config('role', 'none', true);
  select email into v_email from auth.users where id = p_user;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'email', v_email)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.act_as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Writes an expense whose splits don't add up, then forces the deferred check.
create function pg_temp.add_unbalanced_expense() returns void language plpgsql as $$
begin
  insert into tripsplit.expenses (id, trip_id, category_id, description, amount, currency, paid_by)
  values ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001',
          '90000000-0000-4000-8000-000000000001', 'Unbalanced', 1000, 'PHP', 'bbbbbbbb-0000-4000-8000-000000000002');
  insert into tripsplit.expense_splits (expense_id, user_id, split_type, amount) values
    ('f0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'equal', 400),
    ('f0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'equal', 500);
  set constraints all immediate;
end;
$$;

create function pg_temp.add_expense_without_splits() returns void language plpgsql as $$
begin
  insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by)
  values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
          'Nobody shares this', 100, 'PHP', 'bbbbbbbb-0000-4000-8000-000000000002');
  set constraints all immediate;
end;
$$;

create function pg_temp.tripsplit_tests() returns setof text language plpgsql as $tests$
declare
  tap text[] := '{}';
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(67);

    -- -------------------------------------------------------------------------
    -- Fixtures: four auth users (profiles come from ensure_profile)
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, raw_user_meta_data) values
      ('aaaaaaaa-0000-4000-8000-000000000001', 'owner@test.dev',    '{"full_name":"Olivia Owner"}'),
      ('bbbbbbbb-0000-4000-8000-000000000002', 'member@test.dev',   '{"full_name":"Max Member"}'),
      ('cccccccc-0000-4000-8000-000000000003', 'outsider@test.dev', '{"name":"Oscar Outsider"}'),
      ('dddddddd-0000-4000-8000-000000000004', 'member2@test.dev',  '{}');

    -- -------------------------------------------------------------------------
    -- Profiles are created on first use
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
    tap := tap || is(
      (select full_name from tripsplit.ensure_profile()),
      'Olivia Owner',
      'ensure_profile creates a profile from sign-up metadata'
    );
    perform tripsplit.ensure_profile();
    tap := tap || is(
      (select count(*)::int from tripsplit.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
      1,
      'ensure_profile is idempotent'
    );
    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    perform tripsplit.ensure_profile();
    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    perform tripsplit.ensure_profile();

    perform pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
    tap := tap || is(
      (select full_name from tripsplit.ensure_profile()),
      'member2',
      'profile name falls back to the email local part'
    );
    perform pg_temp.act_as_postgres();
    update auth.users set email = 'member2.new@test.dev' where id = 'dddddddd-0000-4000-8000-000000000004';
    perform pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
    tap := tap || is(
      (select email from tripsplit.ensure_profile()),
      'member2.new@test.dev',
      'ensure_profile keeps the email in sync with auth'
    );

    -- -------------------------------------------------------------------------
    -- Creating a trip
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
    tap := tap || lives_ok(
      $$ insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
         values ('e0000000-0000-4000-8000-000000000001', 'Test Trip', '2026-11-03', '2026-11-08', 50000, 'PHP') $$,
      'a signed-in user can create a trip'
    );
    tap := tap || is(
      (select role::text from tripsplit.trip_members
       where trip_id = 'e0000000-0000-4000-8000-000000000001' and user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
      'owner',
      'the creator is added as the owner member'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.categories
       where trip_id = 'e0000000-0000-4000-8000-000000000001' and is_default),
      13,
      'default categories are created with the trip'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.trips (name, start_date, end_date, owner_id)
         values ('Spoofed', '2026-01-01', '2026-01-02', 'bbbbbbbb-0000-4000-8000-000000000002') $$,
      '42501', null,
      'a trip cannot be created on behalf of someone else'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.trip_members (trip_id, user_id)
         values ('e0000000-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003') $$,
      '42501', null,
      'members cannot be inserted directly, even by the owner'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.trips (name, start_date, end_date) values ('Backwards', '2026-01-05', '2026-01-01') $$,
      '23514', null,
      'end date cannot be before start date'
    );

    -- Fixtures: B and D join (Phase 7 does this through the invitation RPC),
    -- plus a category with a known id.
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values
      ('e0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'),
      ('e0000000-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004');
    insert into tripsplit.categories (id, trip_id, name)
    values ('90000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Test category');

    -- -------------------------------------------------------------------------
    -- Outsiders see nothing
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    tap := tap || is_empty(
      $$ select id from tripsplit.trips where id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see the trip'
    );
    tap := tap || is_empty(
      $$ select id from tripsplit.categories where trip_id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see the trip''s categories'
    );
    tap := tap || is_empty(
      $$ select id from tripsplit.trip_members where trip_id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see the trip roster'
    );
    tap := tap || is_empty(
      $$ update tripsplit.trips set name = 'Hacked' where id = 'e0000000-0000-4000-8000-000000000001' returning id $$,
      'outsiders cannot update the trip'
    );
    tap := tap || is_empty(
      $$ select id from tripsplit.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
      'outsiders cannot see travelers'' profiles'
    );

    -- -------------------------------------------------------------------------
    -- Members: read access, no trip administration
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    tap := tap || isnt_empty(
      $$ select id from tripsplit.trips where id = 'e0000000-0000-4000-8000-000000000001' $$,
      'members can see the trip'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.profiles
       where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004')),
      2,
      'members can see fellow travelers'' profiles'
    );
    tap := tap || is_empty(
      $$ select id from tripsplit.profiles where id = 'cccccccc-0000-4000-8000-000000000003' $$,
      'members cannot see unrelated profiles'
    );
    tap := tap || is_empty(
      $$ update tripsplit.trips set name = 'Renamed' where id = 'e0000000-0000-4000-8000-000000000001' returning id $$,
      'members cannot edit the trip'
    );
    tap := tap || is_empty(
      $$ delete from tripsplit.trips where id = 'e0000000-0000-4000-8000-000000000001' returning id $$,
      'members cannot delete the trip'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.categories (trip_id, name) values ('e0000000-0000-4000-8000-000000000001', 'Snacks') $$,
      '42501', null,
      'members cannot add categories'
    );

    -- -------------------------------------------------------------------------
    -- Profiles
    -- -------------------------------------------------------------------------
    tap := tap || lives_ok(
      $$ update tripsplit.profiles set full_name = 'Maxine Member' where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
      'users can update their own name'
    );
    tap := tap || throws_ok(
      $$ update tripsplit.profiles set email = 'spoof@test.dev' where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
      '42501', null,
      'profile email is not writable through the API'
    );
    tap := tap || is_empty(
      $$ update tripsplit.profiles set full_name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning id $$,
      'users cannot edit other people''s profiles'
    );

    -- -------------------------------------------------------------------------
    -- Expenses & splits
    -- -------------------------------------------------------------------------
    tap := tap || lives_ok(
      $$ insert into tripsplit.expenses (id, trip_id, category_id, description, amount, currency, paid_by)
         values ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
                 '90000000-0000-4000-8000-000000000001', 'Dinner', 1000, 'PHP', 'bbbbbbbb-0000-4000-8000-000000000002') $$,
      'members can add expenses'
    );
    tap := tap || lives_ok(
      $$ insert into tripsplit.expense_splits (expense_id, user_id, split_type, amount) values
           ('f0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'equal', 333.33),
           ('f0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'equal', 333.33),
           ('f0000000-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004', 'equal', 333.34) $$,
      'the expense creator can add splits'
    );
    tap := tap || lives_ok('set constraints all immediate', 'splits that add up pass the split-total check');
    set constraints all deferred;

    tap := tap || is(
      (select created_by from tripsplit.expenses where id = 'f0000000-0000-4000-8000-000000000001'),
      'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
      'created_by defaults to the current user'
    );
    tap := tap || throws_ok(
      'select pg_temp.add_unbalanced_expense()',
      'P0001', 'split_total_mismatch',
      'splits must add up to the expense total'
    );
    set constraints all deferred;
    tap := tap || throws_ok(
      'select pg_temp.add_expense_without_splits()',
      'P0001', 'expense_requires_participant',
      'an expense needs at least one participant'
    );
    set constraints all deferred;
    tap := tap || throws_ok(
      $$ insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by)
         values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
                 'Bad payer', 100, 'PHP', 'cccccccc-0000-4000-8000-000000000003') $$,
      'P0001', 'payer_not_member',
      'the payer must be a trip member'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.expense_splits (expense_id, user_id, split_type, amount)
         values ('f0000000-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003', 'equal', 0) $$,
      'P0001', 'participant_not_member',
      'split participants must be trip members'
    );

    -- Currency handling (constraints stay deferred and everything rolls back,
    -- so these expenses don't need splits)
    tap := tap || lives_ok(
      $$ insert into tripsplit.expenses (id, trip_id, category_id, description, amount, currency, exchange_rate, paid_by)
         values ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001',
                 '90000000-0000-4000-8000-000000000001', 'Kaya toast', 24.60, 'SGD', 42.5, 'bbbbbbbb-0000-4000-8000-000000000002') $$,
      'members can add a foreign-currency expense'
    );
    tap := tap || is(
      (select converted_amount from tripsplit.expenses where id = 'f0000000-0000-4000-8000-000000000003'),
      1045.50::numeric,
      'foreign amounts are converted into the trip currency'
    );
    tap := tap || lives_ok(
      $$ insert into tripsplit.expenses (id, trip_id, category_id, description, amount, currency, exchange_rate, paid_by)
         values ('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001',
                 '90000000-0000-4000-8000-000000000001', 'Taxi', 500, 'PHP', 3, 'bbbbbbbb-0000-4000-8000-000000000002') $$,
      'members can add a same-currency expense with a bogus rate'
    );
    tap := tap || is(
      (select exchange_rate from tripsplit.expenses where id = 'f0000000-0000-4000-8000-000000000004'),
      1::numeric,
      'same-currency expenses always use an exchange rate of 1'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, exchange_rate, paid_by)
         values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
                 'Half a yen', 12.5, 'JPY', 0.39, 'bbbbbbbb-0000-4000-8000-000000000002') $$,
      'P0001', 'amount_precision',
      'amounts respect the currency''s decimal places'
    );
    tap := tap || throws_ok(
      $$ update tripsplit.expenses set trip_id = 'e0000000-0000-4000-8000-000000000001'
         where id = 'f0000000-0000-4000-8000-000000000001' $$,
      '42501', null,
      'an expense cannot be moved to another trip'
    );

    -- Edit rights: creator / payer / owner only
    perform pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
    tap := tap || is_empty(
      $$ update tripsplit.expenses set description = 'Edited by D'
         where id = 'f0000000-0000-4000-8000-000000000001' returning id $$,
      'members cannot edit other people''s expenses'
    );
    tap := tap || is_empty(
      $$ delete from tripsplit.expenses where id = 'f0000000-0000-4000-8000-000000000001' returning id $$,
      'members cannot delete other people''s expenses'
    );

    perform pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
    tap := tap || isnt_empty(
      $$ update tripsplit.expenses set description = 'Edited by owner'
         where id = 'f0000000-0000-4000-8000-000000000001' returning id $$,
      'owners can edit any expense in their trip'
    );
    tap := tap || throws_ok(
      $$ update tripsplit.trips set currency = 'USD' where id = 'e0000000-0000-4000-8000-000000000001' $$,
      'P0001', 'trip_currency_locked',
      'the trip currency is locked once expenses exist'
    );
    tap := tap || isnt_empty(
      $$ update tripsplit.trips set name = 'Renamed Trip' where id = 'e0000000-0000-4000-8000-000000000001' returning id $$,
      'owners can edit their trip'
    );
    tap := tap || throws_ok(
      $$ update tripsplit.trips set owner_id = 'bbbbbbbb-0000-4000-8000-000000000002'
         where id = 'e0000000-0000-4000-8000-000000000001' $$,
      '42501', null,
      'trip ownership cannot be reassigned through the API'
    );

    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    tap := tap || is_empty(
      $$ select id from tripsplit.expenses where trip_id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see expenses'
    );
    tap := tap || is_empty(
      $$ select id from tripsplit.expense_splits where expense_id = 'f0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see splits'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.expenses (trip_id, category_id, description, amount, currency, paid_by)
         values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
                 'Sneaky', 100, 'PHP', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
      '42501', null,
      'outsiders cannot add expenses'
    );

    -- -------------------------------------------------------------------------
    -- Settlements
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    tap := tap || lives_ok(
      $$ insert into tripsplit.settlements (id, trip_id, from_user_id, to_user_id, amount, currency, payment_method)
         values ('50000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
                 'bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 500, 'USD', 'gcash') $$,
      'members can record settlements'
    );
    tap := tap || is(
      (select currency from tripsplit.settlements where id = '50000000-0000-4000-8000-000000000001'),
      'PHP',
      'settlements are stored in the trip currency'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.settlements (trip_id, from_user_id, to_user_id, amount, currency)
         values ('e0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002',
                 'cccccccc-0000-4000-8000-000000000003', 100, 'PHP') $$,
      'P0001', 'settlement_party_not_member',
      'both settlement parties must be trip members'
    );

    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    tap := tap || is_empty(
      $$ select id from tripsplit.settlements where trip_id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see settlements'
    );

    -- -------------------------------------------------------------------------
    -- Invitations
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    tap := tap || throws_ok(
      $$ insert into tripsplit.trip_invitations (trip_id, invited_email)
         values ('e0000000-0000-4000-8000-000000000001', 'friend@test.dev') $$,
      '42501', null,
      'members cannot send invitations'
    );

    perform pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
    tap := tap || lives_ok(
      $$ insert into tripsplit.trip_invitations (id, trip_id, invited_email)
         values ('70000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', '  Outsider@Test.dev ') $$,
      'owners can invite by email'
    );
    tap := tap || is(
      (select invited_email from tripsplit.trip_invitations where id = '70000000-0000-4000-8000-000000000001'),
      'outsider@test.dev',
      'invited emails are normalized'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.trip_invitations (trip_id, invited_email)
         values ('e0000000-0000-4000-8000-000000000001', 'member@test.dev') $$,
      'P0001', 'already_member',
      'existing members cannot be invited again'
    );

    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    tap := tap || isnt_empty(
      $$ select id from tripsplit.trip_invitations where id = '70000000-0000-4000-8000-000000000001' $$,
      'invitees can see their own invitation'
    );
    tap := tap || throws_ok(
      $$ update tripsplit.trip_invitations set status = 'accepted'
         where id = '70000000-0000-4000-8000-000000000001' returning id $$,
      '42501', null,
      'invitees cannot accept by editing the invitation row'
    );

    -- -------------------------------------------------------------------------
    -- Membership management
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as('dddddddd-0000-4000-8000-000000000004');
    tap := tap || is_empty(
      $$ delete from tripsplit.trip_members
         where trip_id = 'e0000000-0000-4000-8000-000000000001' and user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
         returning id $$,
      'members cannot remove other members'
    );

    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    tap := tap || is_empty(
      $$ delete from tripsplit.trip_members
         where trip_id = 'e0000000-0000-4000-8000-000000000001' and user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
         returning id $$,
      'the owner cannot be removed'
    );

    -- D shares in an expense, so even the owner can't remove them (see 002 for the happy path).
    perform pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
    tap := tap || throws_ok(
      $$ delete from tripsplit.trip_members
         where trip_id = 'e0000000-0000-4000-8000-000000000001' and user_id = 'dddddddd-0000-4000-8000-000000000004' $$,
      'P0001', 'member_has_activity',
      'owners cannot remove a member who shares in expenses'
    );

    -- -------------------------------------------------------------------------
    -- Category budgets & trip totals
    -- -------------------------------------------------------------------------
    tap := tap || lives_ok(
      $$ insert into tripsplit.budget_categories (trip_id, category_id, planned_amount)
         values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 5000) $$,
      'owners can plan category budgets'
    );
    tap := tap || is(
      (select total_spent from tripsplit.trip_totals where trip_id = 'e0000000-0000-4000-8000-000000000001'),
      2545.50::numeric,
      'trip_totals sums converted amounts'
    );

    perform pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
    tap := tap || throws_ok(
      $$ insert into tripsplit.budget_categories (trip_id, category_id, planned_amount)
         values ('e0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 1) $$,
      '42501', null,
      'members cannot plan category budgets'
    );

    perform pg_temp.act_as('cccccccc-0000-4000-8000-000000000003');
    tap := tap || is_empty(
      $$ select trip_id from tripsplit.trip_totals where trip_id = 'e0000000-0000-4000-8000-000000000001' $$,
      'outsiders cannot see trip totals'
    );

    -- -------------------------------------------------------------------------
    -- Anonymous visitors
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as_anon();
    tap := tap || throws_ok(
      $$ select id from tripsplit.trips $$,
      '42501', null,
      'anonymous visitors have no access to trips'
    );
    tap := tap || throws_ok(
      $$ select id from tripsplit.profiles $$,
      '42501', null,
      'anonymous visitors have no access to profiles'
    );
    tap := tap || throws_ok(
      $$ select tripsplit.ensure_profile() $$,
      '42501', null,
      'anonymous visitors cannot create profiles'
    );

    perform pg_temp.act_as_postgres();
    tap := tap || array(select * from finish());

    -- Undo everything above, including the pgTAP install.
    raise exception 'tripsplit_tests_complete';
  exception when others then
    if sqlerrm <> 'tripsplit_tests_complete' then
      tap := tap || format('not ok - test run aborted: %s (SQLSTATE %s)', sqlerrm, sqlstate);
    end if;
  end;

  return query select unnest(tap);
end;
$tests$;

select * from pg_temp.tripsplit_tests();
