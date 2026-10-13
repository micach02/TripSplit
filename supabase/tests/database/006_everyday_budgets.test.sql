-- =============================================================================
-- TripSplit · Everyday budgets tests (pgTAP): kind, optional end date, default
-- categories per kind, monthly totals, invitations that say what they're for.
--
-- Same pattern as 001–005: one function, everything rolled back, TAP output
-- returned as one result set.
--
-- Cast: owner A (budget + trip), housemate H, outsider O.
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
  a constant uuid := 'a8000000-0000-4000-8000-00000000000a';
  h constant uuid := 'b8000000-0000-4000-8000-00000000000b';
  o constant uuid := 'c8000000-0000-4000-8000-00000000000c';
  budget constant uuid := 'a8100000-0000-4000-8000-000000000001';
  trip constant uuid := 'a8100000-0000-4000-8000-000000000002';
  groceries uuid;
  invite_token uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(16);

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p8-owner@test.dev',     '{"full_name":"Bea Budget"}'),
      (h, 'p8-housemate@test.dev', '{"full_name":"Hugo Housemate"}'),
      (o, 'p8-outsider@test.dev',  '{"full_name":"Olly Outsider"}');
    perform pg_temp.act_as(h); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(o); perform tripsplit.ensure_profile();

    -- -------------------------------------------------------------------------
    -- Kind and dates
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    tap := tap || lives_ok(
      format($$ insert into tripsplit.trips (id, kind, name, start_date, budget, currency)
                values (%L, 'budget', 'Groceries & Food', '2026-09-01', 12000, 'PHP') $$, budget),
      'a budget needs no end date'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.trips (name, start_date, budget, currency) values ('No end', '2026-09-01', 0, 'PHP') $$,
      '23514', null,
      'a trip still needs an end date'
    );
    tap := tap || lives_ok(
      format($$ insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
                values (%L, 'Baguio', '2026-12-01', '2026-12-04', 8000, 'PHP') $$, trip),
      'trips default to kind = trip'
    );
    tap := tap || is(
      (select kind::text from tripsplit.trips where id = trip),
      'trip',
      'an existing-style insert is a trip'
    );
    tap := tap || throws_ok(
      format($$ update tripsplit.trips set kind = 'trip' where id = %L $$, budget),
      '42501', null,
      'a budget can''t be turned into a trip'
    );
    tap := tap || lives_ok(
      format($$ update tripsplit.trips set budget = 15000, name = 'Household' where id = %L $$, budget),
      'the owner can still edit the monthly amount and name'
    );

    -- -------------------------------------------------------------------------
    -- Default categories per kind
    -- -------------------------------------------------------------------------
    tap := tap || isnt_empty(
      format($$ select 1 from tripsplit.categories where trip_id = %L and name = 'Bills & utilities' $$, budget),
      'budgets get everyday categories'
    );
    tap := tap || is_empty(
      format($$ select 1 from tripsplit.categories where trip_id = %L and name in ('Flights', 'Visa', 'Accommodation') $$, budget),
      'budgets don''t get travel categories'
    );
    tap := tap || isnt_empty(
      format($$ select 1 from tripsplit.categories where trip_id = %L and name = 'Flights' $$, trip),
      'trips keep travel categories'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.trip_members where trip_id = budget and user_id = a and role = 'owner'),
      1,
      'the creator owns the budget'
    );

    -- -------------------------------------------------------------------------
    -- Monthly totals
    -- -------------------------------------------------------------------------
    select id into groceries from tripsplit.categories where trip_id = budget and name = 'Groceries';
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', budget, 'category_id', groceries, 'description', 'Market run', 'amount', '1500', 'currency', 'PHP', 'paid_by', a, 'expense_date', '2026-09-12'),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '1500.00')));
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', budget, 'category_id', groceries, 'description', 'Supermarket', 'amount', '2200.50', 'currency', 'PHP', 'paid_by', a, 'expense_date', '2026-10-03'),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '2200.50')));
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', budget, 'category_id', groceries, 'description', 'Bakery', 'amount', '300', 'currency', 'PHP', 'paid_by', a, 'expense_date', '2026-10-28'),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '300.00')));

    tap := tap || is(
      (select total_spent from tripsplit.trip_month_totals where trip_id = budget and month = '2026-10-01'),
      2500.50::numeric(14, 2),
      'October spending is summed on its own'
    );
    tap := tap || is(
      (select string_agg(to_char(month, 'YYYY-MM') || '=' || expense_count, ',' order by month)
       from tripsplit.trip_month_totals where trip_id = budget),
      '2026-09=1,2026-10=2',
      'one row per month with its expense count'
    );
    perform pg_temp.act_as(o);
    tap := tap || is_empty(
      format($$ select 1 from tripsplit.trip_month_totals where trip_id = %L $$, budget),
      'outsiders see no monthly totals'
    );

    -- -------------------------------------------------------------------------
    -- Invitations say it's a budget
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name)
    values (budget, 'p8-housemate@test.dev', 'Hugo') returning token into invite_token;

    perform pg_temp.act_as(h);
    tap := tap || is(
      (select trip_kind::text || ' / ' || coalesce(end_date::text, 'no end') from tripsplit.get_my_invitations() where trip_id = budget),
      'budget / no end',
      'the invitee''s list shows a budget with no end date'
    );
    tap := tap || is(
      (select trip_kind::text from tripsplit.get_invitation_preview(invite_token)),
      'budget',
      'the invite link preview says it''s a budget'
    );
    tap := tap || is(
      tripsplit.accept_invitation_link(invite_token),
      budget,
      'a housemate joins the budget like a trip'
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
