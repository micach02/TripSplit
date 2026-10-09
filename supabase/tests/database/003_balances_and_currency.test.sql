-- =============================================================================
-- TripSplit · Phase 4 tests (pgTAP): invitee names, member balances,
-- changing a trip's currency.
--
-- Same pattern as 001/002: everything runs inside one function and is rolled
-- back; the TAP output comes back as one result set.
--
-- Cast: owner A, member B, invitee C, outsider D.
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

-- Expenses in a trip whose split amounts don't add up to the converted total.
create function pg_temp.unbalanced_expenses(p_trip uuid) returns integer language sql as $$
  select count(*)::int
  from tripsplit.expenses e
  where e.trip_id = p_trip
    and e.converted_amount <> (select coalesce(sum(s.amount), 0) from tripsplit.expense_splits s where s.expense_id = e.id);
$$;

create function pg_temp.tripsplit_tests() returns setof text language plpgsql as $tests$
declare
  tap text[] := '{}';
  a constant uuid := 'a3000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b3000000-0000-4000-8000-00000000000b';
  c constant uuid := 'c3000000-0000-4000-8000-00000000000c';
  d constant uuid := 'd3000000-0000-4000-8000-00000000000d';
  trip constant uuid := 'f3000000-0000-4000-8000-000000000001';
  food uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  e4 uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(32);

    -- -------------------------------------------------------------------------
    -- Fixtures: A owns a PHP trip with B
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p4-owner@test.dev',    '{"full_name":"Olivia Owner"}'),
      (b, 'p4-member@test.dev',   '{"full_name":"Max Member"}'),
      (c, 'p4-invitee@test.dev',  '{"full_name":"Ivy Invitee"}'),
      (d, 'p4-outsider@test.dev', '{"full_name":"Oscar Outsider"}');

    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(d); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (trip, 'Currency Trip', '2026-11-03', '2026-11-08', 50000, 'PHP');
    select id into food from tripsplit.categories where trip_id = trip and name = 'Food';
    insert into tripsplit.budget_categories (trip_id, category_id, planned_amount) values (trip, food, 10000);
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, b);

    -- -------------------------------------------------------------------------
    -- Invitee names
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    tap := tap || lives_ok(
      format($$ insert into tripsplit.trip_invitations (id, trip_id, invited_email, invited_name)
                values ('73000000-0000-4000-8000-000000000001', %L, 'p4-invitee@test.dev', 'Ivy') $$, trip),
      'owners can invite with a name'
    );
    tap := tap || is(
      (select invited_name from tripsplit.trip_invitations where id = '73000000-0000-4000-8000-000000000001'),
      'Ivy',
      'the invitee name is stored'
    );
    tap := tap || throws_ok(
      format($$ insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name)
                values (%L, 'blank@test.dev', '   ') $$, trip),
      '23514', null,
      'a blank invitee name is rejected'
    );

    -- -------------------------------------------------------------------------
    -- Ledger: three expenses and a settlement
    --   E1 ₱1,000 paid by B, equal            → A 500.00, B 500.00
    --   E2 S$24.60 @ 42.5 = ₱1,045.50 by A, 2:1 → A 697.00, B 348.50
    --   E3 ₱100.01 paid by A, equal           → A 50.00,  B 50.01
    --   A paid B ₱100
    --   A: paid 1145.51 − share 1247.00 + sent 100 = −1.49
    --   B: paid 1000.00 − share  898.51 − received 100 = +1.49
    -- -------------------------------------------------------------------------
    e1 := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Dinner', 'amount', '1000', 'currency', 'PHP', 'paid_by', b),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '500.00'),
        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '500.00')));
    e2 := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Kaya toast', 'amount', '24.60',
                         'currency', 'SGD', 'exchange_rate', '42.5', 'paid_by', a),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'shares', 'value', 2, 'amount', '697.00'),
        jsonb_build_object('user_id', b, 'split_type', 'shares', 'value', 1, 'amount', '348.50')));
    e3 := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Snacks', 'amount', '100.01', 'currency', 'PHP', 'paid_by', a),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '50.00'),
        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '50.01')));
    insert into tripsplit.settlements (trip_id, from_user_id, to_user_id, amount, currency, payment_method)
    values (trip, a, b, 100, 'PHP', 'gcash');

    -- -------------------------------------------------------------------------
    -- Member balances
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(b);
    tap := tap || is(
      (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = a),
      -1.49::numeric,
      'the owner still owes ₱1.49 after paying ₱100 back'
    );
    tap := tap || is(
      (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = b),
      1.49::numeric,
      'the member should receive ₱1.49'
    );
    tap := tap || is(
      (select paid || '/' || share || '/' || settlements_received from tripsplit.trip_member_balances where trip_id = trip and user_id = b),
      '1000.00/898.51/100.00',
      'balances break down into paid, share and settlements'
    );
    tap := tap || is(
      (select sum(net) from tripsplit.trip_member_balances where trip_id = trip),
      0::numeric,
      'balances across the trip sum to zero'
    );
    perform pg_temp.act_as(d);
    tap := tap || is_empty(
      format($$ select user_id from tripsplit.trip_member_balances where trip_id = %L $$, trip),
      'outsiders cannot see balances'
    );

    -- -------------------------------------------------------------------------
    -- Changing the trip currency
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    tap := tap || throws_ok(
      format($$ update tripsplit.trips set currency = 'USD' where id = %L $$, trip),
      'P0001', 'trip_currency_locked',
      'a plain update still cannot change the currency'
    );

    -- A US$10 expense, so one expense is already in the target currency
    perform pg_temp.act_as(b);
    e4 := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Souvenir', 'amount', '10',
                         'currency', 'USD', 'exchange_rate', '56', 'paid_by', b),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '280.00'),
        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '280.00')));

    tap := tap || throws_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'USD', 0.0178) $$, trip),
      '42501', 'not_permitted',
      'only the owner can change the trip currency'
    );

    perform pg_temp.act_as(a);
    tap := tap || throws_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'USD', 0) $$, trip),
      'P0001', 'invalid_exchange_rate',
      'the conversion rate must be positive'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'XYZ', 1) $$, trip),
      'P0001', 'unsupported_currency',
      'only supported currencies are allowed'
    );
    tap := tap || lives_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'USD', 0.0178) $$, trip),
      'the owner converts the trip from PHP to USD'
    );
    tap := tap || is(
      (select currency || ' ' || budget from tripsplit.trips where id = trip),
      'USD 890.00',
      'the budget is converted'
    );
    tap := tap || is(
      (select exchange_rate || ' / ' || converted_amount from tripsplit.expenses where id = e1),
      '0.01780000 / 17.80',
      'a peso expense is re-based onto USD'
    );
    tap := tap || is(
      (select exchange_rate || ' / ' || converted_amount from tripsplit.expenses where id = e2),
      '0.75650000 / 18.61',
      'a foreign expense chains its rate through the old trip currency'
    );
    tap := tap || is(
      (select amount || ' ' || currency || ' @ ' || exchange_rate || ' = ' || converted_amount from tripsplit.expenses where id = e4),
      '10.00 USD @ 1.00000000 = 10.00',
      'an expense already in the new currency uses rate 1'
    );
    tap := tap || is(
      (select string_agg(amount::text, ',' order by amount) from tripsplit.expense_splits where expense_id = e1),
      '8.90,8.90',
      'split amounts are re-spread over the new total'
    );
    tap := tap || is(pg_temp.unbalanced_expenses(trip), 0, 'every expense still adds up after converting to USD');
    tap := tap || is(
      (select currency || ' ' || amount from tripsplit.settlements where trip_id = trip),
      'USD 1.78',
      'settlements are converted'
    );
    tap := tap || is(
      (select planned_amount from tripsplit.budget_categories where trip_id = trip),
      178.00::numeric,
      'category budgets are converted'
    );
    tap := tap || lives_ok('set constraints all immediate', 'the converted trip passes the split-total checks');
    set constraints all deferred;
    tap := tap || is(
      (select sum(net) from tripsplit.trip_member_balances where trip_id = trip),
      0::numeric,
      'balances still sum to zero after converting'
    );

    -- To a zero-decimal currency
    tap := tap || lives_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'JPY', 150) $$, trip),
      'the owner converts the trip from USD to JPY'
    );
    tap := tap || is(
      (select budget from tripsplit.trips where id = trip),
      133500::numeric,
      'the JPY budget has no decimals'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.expense_splits s join tripsplit.expenses e on e.id = s.expense_id
       where e.trip_id = trip and s.amount <> round(s.amount)),
      0,
      'every JPY share is a whole yen'
    );
    tap := tap || is(
      (select string_agg(amount::text, ',' order by amount) from tripsplit.expense_splits where expense_id = e3),
      '133.00,134.00',
      'an odd yen goes to exactly one share'
    );
    tap := tap || is(pg_temp.unbalanced_expenses(trip), 0, 'every expense still adds up after converting to JPY');
    tap := tap || lives_ok('set constraints all immediate', 'the JPY trip passes the split-total checks');
    set constraints all deferred;
    tap := tap || is(
      (select sum(net) from tripsplit.trip_member_balances where trip_id = trip),
      0::numeric,
      'balances still sum to zero in JPY'
    );
    tap := tap || lives_ok(
      format($$ select tripsplit.change_trip_currency(%L, 'JPY', 1) $$, trip),
      'converting to the current currency is a no-op'
    );
    tap := tap || is(
      (select string_agg(amount || ' ' || currency, ', ' order by description) from tripsplit.expenses where trip_id = trip),
      '1000.00 PHP, 24.60 SGD, 100.01 PHP, 10.00 USD',
      'original expense amounts and currencies are never changed'
    );

    perform pg_temp.act_as_postgres();
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
