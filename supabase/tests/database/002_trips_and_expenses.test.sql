-- =============================================================================
-- TripSplit · Phase 2/3 tests (pgTAP): invitations, member guard,
-- save_expense, trip cover storage, trip deletion.
--
-- Same pattern as 001: everything runs inside one function and is rolled back;
-- the TAP output comes back as one result set.
--
-- Cast: owner A, member B, invitee C, member D (added later), outsider E.
-- =============================================================================

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

create function pg_temp.tripsplit_tests() returns setof text language plpgsql as $tests$
declare
  tap text[] := '{}';
  a constant uuid := 'a2000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b2000000-0000-4000-8000-00000000000b';
  c constant uuid := 'c2000000-0000-4000-8000-00000000000c';
  d constant uuid := 'd2000000-0000-4000-8000-00000000000d';
  e constant uuid := 'e2000000-0000-4000-8000-00000000000e';
  trip constant uuid := 'f2000000-0000-4000-8000-000000000001';
  food uuid;
  expense uuid;
  fx_expense uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(42);

    -- -------------------------------------------------------------------------
    -- Fixtures
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p2-owner@test.dev',    '{"full_name":"Olivia Owner"}'),
      (b, 'p2-member@test.dev',   '{"full_name":"Max Member"}'),
      (c, 'p2-invitee@test.dev',  '{"full_name":"Ivy Invitee"}'),
      (d, 'p2-member2@test.dev',  '{"full_name":"Dan Member"}'),
      (e, 'p2-outsider@test.dev', '{"full_name":"Oscar Outsider"}');

    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (trip, 'Phase Trip', '2026-11-03', '2026-11-08', 50000, 'PHP');
    select id into food from tripsplit.categories where trip_id = trip and name = 'Food';

    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(d); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(e); perform tripsplit.ensure_profile();
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, b);

    -- -------------------------------------------------------------------------
    -- Invitations
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    tap := tap || lives_ok(
      format($$ insert into tripsplit.trip_invitations (id, trip_id, invited_email)
                values ('72000000-0000-4000-8000-000000000001', %L, 'p2-invitee@test.dev') $$, trip),
      'owners can invite someone who has no profile yet'
    );

    perform pg_temp.act_as(c);
    tap := tap || is(
      (select trip_name from tripsplit.get_my_invitations()),
      'Phase Trip',
      'invitees see the trip name before joining'
    );
    tap := tap || is(
      (select invited_by_name from tripsplit.get_my_invitations()),
      'Olivia Owner',
      'invitees see who invited them'
    );
    tap := tap || is_empty(
      format($$ select id from tripsplit.trips where id = %L $$, trip),
      'invitees still cannot read the trip itself'
    );

    perform pg_temp.act_as(e);
    tap := tap || is_empty(
      'select * from tripsplit.get_my_invitations()',
      'other users do not see someone else''s invitation'
    );
    tap := tap || throws_ok(
      $$ select tripsplit.accept_invitation('72000000-0000-4000-8000-000000000001') $$,
      'P0001', 'invitation_not_found',
      'nobody else can accept an invitation'
    );

    perform pg_temp.act_as(c);
    tap := tap || is(
      tripsplit.accept_invitation('72000000-0000-4000-8000-000000000001'),
      trip,
      'accepting returns the trip id'
    );
    tap := tap || isnt_empty(
      format($$ select id from tripsplit.trips where id = %L $$, trip),
      'after accepting, the invitee can see the trip'
    );
    tap := tap || is(
      (select role::text from tripsplit.trip_members where trip_id = trip and user_id = c),
      'member',
      'the invitee joins as a member'
    );
    tap := tap || is(
      (select status::text from tripsplit.trip_invitations where id = '72000000-0000-4000-8000-000000000001'),
      'accepted',
      'the invitation is marked accepted'
    );
    tap := tap || throws_ok(
      $$ select tripsplit.accept_invitation('72000000-0000-4000-8000-000000000001') $$,
      'P0001', 'invitation_not_pending',
      'an invitation can only be answered once'
    );

    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (id, trip_id, invited_email)
    values ('72000000-0000-4000-8000-000000000002', trip, 'p2-outsider@test.dev');
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set expires_at = now() - interval '1 minute'
    where id = '72000000-0000-4000-8000-000000000002';

    perform pg_temp.act_as(e);
    tap := tap || is_empty(
      'select * from tripsplit.get_my_invitations()',
      'expired invitations are not listed'
    );
    tap := tap || throws_ok(
      $$ select tripsplit.accept_invitation('72000000-0000-4000-8000-000000000002') $$,
      'P0001', 'invitation_expired',
      'expired invitations cannot be accepted'
    );

    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (id, trip_id, invited_email)
    values ('72000000-0000-4000-8000-000000000003', trip, 'p2-member2@test.dev');
    perform pg_temp.act_as(d);
    tap := tap || lives_ok(
      $$ select tripsplit.decline_invitation('72000000-0000-4000-8000-000000000003') $$,
      'invitees can decline'
    );
    tap := tap || is_empty(
      format($$ select id from tripsplit.trips where id = %L $$, trip),
      'declining does not join the trip'
    );

    -- -------------------------------------------------------------------------
    -- save_expense
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(b);
    expense := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', '  Dinner  ',
                         'amount', '1000.00', 'currency', 'PHP', 'paid_by', b, 'expense_date', '2026-11-04'),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '500.00'),
        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '500.00'))
    );
    tap := tap || isnt(expense, null::uuid, 'members can save an expense with its splits');
    tap := tap || is(
      (select description || ' / ' || converted_amount::text || ' / ' || created_by::text
       from tripsplit.expenses where id = expense),
      'Dinner / 1000.00 / ' || b::text,
      'the expense is trimmed, converted and attributed to its creator'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.expense_splits where expense_id = expense),
      2,
      'one split per participant'
    );

    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Pct',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'percentage', 'value', 60, 'amount', 600),
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'percentage', 'value', 30, 'amount', 400))) $$,
        trip, food, b, a, b),
      'P0001', 'split_percentage_total',
      'percentages must add up to 100'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Custom',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'custom', 'value', 700, 'amount', 700),
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'custom', 'value', 200, 'amount', 300))) $$,
        trip, food, b, a, b),
      'P0001', 'split_custom_total',
      'custom amounts must add up to the expense'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Mixed',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', 500),
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'shares', 'value', 1, 'amount', 500))) $$,
        trip, food, b, a, b),
      'P0001', 'invalid_split',
      'one split method per expense'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Shares',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'shares', 'value', 0, 'amount', 0),
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'shares', 'value', 1, 'amount', 1000))) $$,
        trip, food, b, a, b),
      'P0001', 'invalid_split_value',
      'every share must be greater than zero'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Short',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', 400),
          jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', 500))) $$,
        trip, food, b, a, b),
      'P0001', 'split_total_mismatch',
      'split amounts must add up to the converted total'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Nobody',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        '[]'::jsonb) $$,
        trip, food, b),
      'P0001', 'expense_requires_participant',
      'an expense needs at least one participant'
    );

    -- Foreign currency, custom split in SGD
    fx_expense := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Kaya toast',
                         'amount', '24.60', 'currency', 'SGD', 'exchange_rate', '42.5', 'paid_by', b),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'custom', 'value', '10.00', 'amount', '425.00'),
        jsonb_build_object('user_id', b, 'split_type', 'custom', 'value', '14.60', 'amount', '620.50'))
    );
    tap := tap || is(
      (select converted_amount from tripsplit.expenses where id = fx_expense),
      1045.50::numeric,
      'foreign-currency expenses are saved with their converted total'
    );

    perform pg_temp.act_as(e);
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Intruder',
                           'amount', 100, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', 100))) $$,
        trip, food, a, a),
      '42501', null,
      'outsiders cannot save expenses into a trip'
    );

    -- Updates: the owner may edit; another member may not
    perform pg_temp.act_as(a);
    perform tripsplit.save_expense(
      jsonb_build_object('id', expense, 'trip_id', trip, 'category_id', food, 'description', 'Dinner (edited)',
                         'amount', '1000', 'currency', 'PHP', 'paid_by', b),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'percentage', 'value', 60, 'amount', '600.00'),
        jsonb_build_object('user_id', b, 'split_type', 'percentage', 'value', 40, 'amount', '400.00'))
    );
    tap := tap || is(
      (select string_agg(amount::text, ',' order by amount desc) from tripsplit.expense_splits where expense_id = expense),
      '600.00,400.00',
      'editing an expense replaces its splits'
    );

    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, d);
    perform pg_temp.act_as(d);
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('id', %L::uuid, 'trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Hijack',
                           'amount', 1000, 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', 1000))) $$,
        expense, trip, food, d, d),
      '42501', 'expense_not_editable',
      'members cannot edit expenses they did not create or pay for'
    );
    tap := tap || is(
      (select description from tripsplit.expenses where id = expense),
      'Dinner (edited)',
      'a rejected edit leaves the expense untouched'
    );

    -- -------------------------------------------------------------------------
    -- Member guard
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    tap := tap || isnt_empty(
      format($$ delete from tripsplit.trip_members where trip_id = %L and user_id = %L returning id $$, trip, c),
      'owners can remove a member with no activity'
    );
    tap := tap || throws_ok(
      format($$ delete from tripsplit.trip_members where trip_id = %L and user_id = %L $$, trip, b),
      'P0001', 'member_has_activity',
      'members with expenses cannot be removed'
    );
    perform pg_temp.act_as(b);
    tap := tap || throws_ok(
      format($$ delete from tripsplit.trip_members where trip_id = %L and user_id = %L $$, trip, b),
      'P0001', 'member_has_activity',
      'members with expenses cannot leave'
    );
    perform pg_temp.act_as(d);
    tap := tap || isnt_empty(
      format($$ delete from tripsplit.trip_members where trip_id = %L and user_id = %L returning id $$, trip, d),
      'members with no activity can leave'
    );

    -- -------------------------------------------------------------------------
    -- Trip cover storage
    -- -------------------------------------------------------------------------
    tap := tap || is(
      tripsplit_private.trip_id_from_object(trip::text || '/cover.jpg'),
      trip,
      'cover paths are keyed by trip id'
    );
    tap := tap || is(
      tripsplit_private.trip_id_from_object('not-a-trip/cover.jpg'),
      null::uuid,
      'malformed cover paths map to no trip'
    );

    perform pg_temp.act_as(a);
    tap := tap || lives_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-trip-covers', %L) $$,
             trip::text || '/cover-test.jpg'),
      'owners can upload a trip cover'
    );
    perform pg_temp.act_as(b);
    tap := tap || isnt_empty(
      format($$ select id from storage.objects where bucket_id = 'tripsplit-trip-covers' and name = %L $$,
             trip::text || '/cover-test.jpg'),
      'members can see the trip cover'
    );
    tap := tap || throws_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-trip-covers', %L) $$,
             trip::text || '/sneaky.jpg'),
      '42501', null,
      'members cannot upload trip covers'
    );
    perform pg_temp.act_as(e);
    tap := tap || is_empty(
      format($$ select id from storage.objects where bucket_id = 'tripsplit-trip-covers' and name like %L $$,
             trip::text || '/%'),
      'outsiders cannot see trip covers'
    );

    -- -------------------------------------------------------------------------
    -- Deleting a trip with activity removes everything in it
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(b);
    tap := tap || isnt_empty(
      format($$ delete from tripsplit.expenses where id = %L returning id $$, fx_expense),
      'creators can delete their expense'
    );
    perform pg_temp.act_as(a);
    tap := tap || isnt_empty(
      format($$ delete from tripsplit.trips where id = %L returning id $$, trip),
      'owners can delete a trip that has expenses and members'
    );
    perform pg_temp.act_as_postgres();
    tap := tap || is(
      (select count(*)::int from tripsplit.expenses where trip_id = trip)
        + (select count(*)::int from tripsplit.trip_members where trip_id = trip)
        + (select count(*)::int from tripsplit.categories where trip_id = trip),
      0,
      'deleting a trip removes its expenses, members and categories'
    );

    tap := tap || array(select * from finish());
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
