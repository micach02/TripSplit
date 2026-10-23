-- =============================================================================
-- TripSplit · Search tests (pgTAP): only your own trips, every word must match,
-- categories / people / notes / trip names / amounts, wildcards are literal.
--
-- Same pattern as 001–009: one function, everything rolled back, TAP output
-- returned as one result set.
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
  a constant uuid := 'a1000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b1000000-0000-4000-8000-00000000000b';
  x constant uuid := 'c1000000-0000-4000-8000-00000000000c';
  trip constant uuid := 'a1100000-0000-4000-8000-000000000001';
  other constant uuid := 'a1100000-0000-4000-8000-000000000002';
  mika uuid;
  food uuid;
  fun uuid;
  transport uuid;
  other_food uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(14);

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'se-a@test.dev', '{"full_name":"Ana Search"}'),
      (b, 'se-b@test.dev', '{"full_name":"Ben Search"}'),
      (x, 'se-x@test.dev', '{"full_name":"Xia Search"}');
    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(x); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (other, 'Secret Trip', current_date, current_date + 2, 0, 'PHP');
    select id into other_food from tripsplit.categories where trip_id = other and name = 'Food';
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', other, 'category_id', other_food, 'description', 'Seafood secret', 'amount', '320',
                         'currency', 'PHP', 'paid_by', x, 'expense_date', current_date),
      jsonb_build_array(jsonb_build_object('user_id', x, 'split_type', 'custom', 'value', '320', 'amount', '320.00')));

    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, destination, start_date, end_date, budget, currency)
    values (trip, 'Bohol Weekend', 'Panglao', current_date - 3, current_date + 1, 20000, 'PHP');
    select id into food from tripsplit.categories where trip_id = trip and name = 'Food';
    select id into fun from tripsplit.categories where trip_id = trip and name = 'Activities';
    select id into transport from tripsplit.categories where trip_id = trip and name = 'Transportation';
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, b);
    perform pg_temp.act_as(a);
    mika := tripsplit.add_trip_person(trip, 'Mika');

    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Seafood dinner', 'amount', '4800',
                         'currency', 'PHP', 'paid_by', a, 'expense_date', current_date - 1),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'custom', 'value', '1600', 'amount', '1600.00'),
                        jsonb_build_object('user_id', b, 'split_type', 'custom', 'value', '1600', 'amount', '1600.00'),
                        jsonb_build_object('user_id', mika, 'split_type', 'custom', 'value', '1600', 'amount', '1600.00')));
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', fun, 'description', 'Island hopping', 'amount', '6000',
                         'currency', 'PHP', 'paid_by', mika, 'expense_date', current_date),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'custom', 'value', '3000', 'amount', '3000.00'),
                        jsonb_build_object('user_id', mika, 'split_type', 'custom', 'value', '3000', 'amount', '3000.00')));
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', transport, 'description', 'Grab to the port', 'amount', '320',
                         'currency', 'PHP', 'paid_by', b, 'expense_date', current_date - 2, 'notes', 'Early ferry to 100% Panglao'),
      jsonb_build_array(jsonb_build_object('user_id', b, 'split_type', 'custom', 'value', '320', 'amount', '320.00')));

    -- -------------------------------------------------------------------------
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('seafood')),
      array['Seafood dinner'],
      'finds by description, only on your own trips'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.search_expenses('DINNER  seafood')),
      1,
      'words match in any order, ignoring case and extra spaces'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.search_expenses('seafood island')),
      0,
      'every word has to match'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('activities')),
      array['Island hopping'],
      'finds by category'
    );
    tap := tap || is(
      (select array_agg(description order by description) from tripsplit.search_expenses('mika')),
      array['Island hopping', 'Seafood dinner'],
      'finds by who paid or shared, including people added by name'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('early ferry')),
      array['Grab to the port'],
      'finds by notes'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.search_expenses('bohol')),
      3,
      'finds by budget or trip name'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.search_expenses('panglao')),
      3,
      'and by destination'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('4,800')),
      array['Seafood dinner'],
      'a number matches the amount exactly, commas and all'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('320')),
      array['Grab to the port'],
      'without matching longer amounts that merely contain it'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('100%')),
      array['Grab to the port'],
      'wildcard characters are matched literally'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.search_expenses('   ')),
      0,
      'a blank search finds nothing'
    );
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('bohol', 2)),
      array['Island hopping', 'Seafood dinner'],
      'newest first, up to the limit'
    );

    perform pg_temp.act_as(x);
    tap := tap || is(
      (select array_agg(description) from tripsplit.search_expenses('seafood')),
      array['Seafood secret'],
      'someone else only finds their own'
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
