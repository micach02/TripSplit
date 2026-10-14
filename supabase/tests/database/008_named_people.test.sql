-- =============================================================================
-- TripSplit · People added by name (pgTAP): adding, who may rename or remove
-- them, using them in expenses, balances and settlements, the guards that keep
-- history intact, and taking a named person's place through an invitation.
--
-- Same pattern as 001–007: one function, everything rolled back, TAP output
-- returned as one result set.
--
-- Cast: owner A, member B, outsider X, newcomer C (takes over "Carl"),
-- named people Carl, Dana, Fay, Gus.
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
  a constant uuid := 'aa000000-0000-4000-8000-00000000000a';
  b constant uuid := 'bb000000-0000-4000-8000-00000000000b';
  x constant uuid := 'cc000000-0000-4000-8000-00000000000c';
  c constant uuid := 'dd000000-0000-4000-8000-00000000000d';
  trip constant uuid := 'aa100000-0000-4000-8000-000000000001';
  other_trip constant uuid := 'aa100000-0000-4000-8000-000000000002';
  food uuid;
  carl uuid;
  dana uuid;
  fay uuid;
  gus uuid;
  stranger uuid;
  expense uuid;
  invite_token uuid;
  gus_token uuid;
  carl_net numeric;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(32);

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'np-owner@test.dev',    '{"full_name":"Ana Owner"}'),
      (b, 'np-member@test.dev',   '{"full_name":"Ben Member"}'),
      (x, 'np-outsider@test.dev', '{"full_name":"Xia Outsider"}'),
      (c, 'np-carl@test.dev',     '{"full_name":"Carl Real"}');
    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(c); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(x); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (other_trip, 'Xia Trip', current_date, current_date + 3, 1000, 'PHP');
    stranger := tripsplit.add_trip_person(other_trip, 'Stranger');

    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (trip, 'Bohol', current_date, current_date + 4, 20000, 'PHP');
    select id into food from tripsplit.categories where trip_id = trip and name = 'Food';
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, b);

    -- -------------------------------------------------------------------------
    -- Adding people
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(b);
    carl := tripsplit.add_trip_person(trip, '  Carl  ');
    tap := tap || is(
      (select row(full_name, email, guest_trip_id, added_by)::text from tripsplit.profiles where id = carl),
      row('Carl', null::text, trip, b)::text,
      'a member adds someone by name: trimmed, no email, tied to the trip, added by them'
    );
    tap := tap || is(
      (select role::text from tripsplit.trip_members where trip_id = trip and user_id = carl),
      'member',
      'the named person is a member of the trip'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.add_trip_person(%L, 'carl') $$, trip),
      'P0001', 'person_name_taken',
      'names are unique within a trip, ignoring case'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.add_trip_person(%L, '   ') $$, trip),
      'P0001', 'person_name_invalid',
      'a blank name is refused'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.add_trip_person(%L, %L) $$, trip, repeat('n', 61)),
      'P0001', 'person_name_invalid',
      'a name over 60 characters is refused'
    );

    perform pg_temp.act_as(a);
    dana := tripsplit.add_trip_person(trip, 'Dana');
    fay := tripsplit.add_trip_person(trip, 'Fay');
    tap := tap || ok(
      exists (select 1 from tripsplit.profiles where id = carl),
      'members see the named people on their trip'
    );

    perform pg_temp.act_as(x);
    tap := tap || throws_ok(
      format($$ select tripsplit.add_trip_person(%L, 'Eve') $$, trip),
      'P0001', 'not_permitted',
      'someone not on the trip can''t add people to it'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.profiles where id = carl),
      0,
      'outsiders can''t see a trip''s named people'
    );

    -- -------------------------------------------------------------------------
    -- Named people in expenses, balances and settlements
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(b);
    expense := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Dinner', 'amount', '900',
                         'currency', 'PHP', 'paid_by', carl),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '450.00'),
                        jsonb_build_object('user_id', carl, 'split_type', 'equal', 'amount', '450.00')));
    tap := tap || ok(
      (select participant_ids @> array[carl, a] from tripsplit.expenses where id = expense),
      'a named person can pay and share an expense'
    );
    tap := tap || is(
      (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = carl),
      450.00::numeric,
      'their balance is worked out like anyone else''s'
    );
    insert into tripsplit.settlements (trip_id, from_user_id, to_user_id, amount, currency)
    values (trip, a, carl, 200, 'PHP');
    tap := tap || is(
      (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = carl),
      250.00::numeric,
      'any member can record a payment to a named person'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L, 'category_id', %L, 'description', 'Wrong trip', 'amount', '10', 'currency', 'PHP', 'paid_by', %L),
        jsonb_build_array(jsonb_build_object('user_id', %L, 'split_type', 'equal', 'amount', '10.00'))) $$,
        trip, food, stranger, a),
      'P0001', 'payer_not_member',
      'a named person from another trip can''t be used here'
    );

    -- -------------------------------------------------------------------------
    -- Renaming and removing
    -- -------------------------------------------------------------------------
    perform tripsplit.rename_trip_person(carl, 'Carlos');
    tap := tap || is((select full_name from tripsplit.profiles where id = carl), 'Carlos', 'whoever added someone can rename them');
    tap := tap || throws_ok(
      format($$ select tripsplit.rename_trip_person(%L, 'Danielle') $$, dana),
      'P0001', 'not_permitted',
      'other members can''t rename someone they didn''t add'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.rename_trip_person(%L, 'fay') $$, carl),
      'P0001', 'person_name_taken',
      'renaming can''t duplicate another name on the trip'
    );
    update tripsplit.profiles set full_name = 'Hacked' where id = carl;
    tap := tap || is((select full_name from tripsplit.profiles where id = carl), 'Carlos', 'a named person''s profile can''t be edited directly');

    perform pg_temp.act_as(a);
    perform tripsplit.rename_trip_person(carl, 'Carl');
    tap := tap || is((select full_name from tripsplit.profiles where id = carl), 'Carl', 'the owner can rename anyone added by name');
    tap := tap || throws_ok(
      format($$ select tripsplit.remove_trip_person(%L) $$, carl),
      'P0001', 'member_has_activity',
      'someone with expenses or settlements can''t be removed'
    );
    insert into tripsplit.recurring_expenses (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month)
    values (trip, food, 'Water delivery', 300, a, array[a, fay], 5);
    tap := tap || throws_ok(
      format($$ select tripsplit.remove_trip_person(%L) $$, fay),
      'P0001', 'person_in_recurring',
      'someone in a recurring expense can''t be removed'
    );
    perform tripsplit.remove_trip_person(dana);
    tap := tap || ok(
      not exists (select 1 from tripsplit.profiles where id = dana)
      and not exists (select 1 from tripsplit.trip_members where user_id = dana),
      'the owner removes someone without history; their membership goes too'
    );
    perform pg_temp.act_as(x);
    tap := tap || throws_ok(
      format($$ select tripsplit.remove_trip_person(%L) $$, fay),
      'P0001', 'person_not_found',
      'outsiders can''t remove a trip''s named people'
    );

    -- -------------------------------------------------------------------------
    -- Taking a named person's place through an invitation
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.recurring_expenses (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month)
    values (trip, food, 'Boat', 1000, carl, array[carl, a], 10);
    carl_net := (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = carl);
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name, person_id)
    values (trip, 'np-carl@test.dev', 'Carl', carl)
    returning token into invite_token;
    tap := tap || throws_ok(
      format($$ insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name, person_id)
                values (%L, 'someone@test.dev', 'Stranger', %L) $$, trip, stranger),
      'P0001', 'person_not_found',
      'an invitation can only stand in for a named person on the same trip'
    );

    perform pg_temp.act_as(c);
    tap := tap || is(
      (select person_name from tripsplit.get_invitation_preview(invite_token)),
      'Carl',
      'the invite preview says whose place they take'
    );
    tap := tap || is(tripsplit.accept_invitation_link(invite_token), trip, 'accepting joins the trip');
    tap := tap || ok(
      (select paid_by = c and participant_ids @> array[c] and not (participant_ids @> array[carl])
       from tripsplit.expenses where id = expense),
      'what the named person paid is now the new member''s'
    );
    tap := tap || ok(
      exists (select 1 from tripsplit.expense_splits where expense_id = expense and user_id = c)
      and not exists (select 1 from tripsplit.expense_splits where user_id = carl),
      'their shares moved too'
    );
    tap := tap || ok(
      exists (select 1 from tripsplit.settlements where trip_id = trip and to_user_id = c),
      'and the settlement'
    );
    tap := tap || ok(
      (select paid_by = c and participant_ids @> array[c, a] and cardinality(participant_ids) = 2
       from tripsplit.recurring_expenses where description = 'Boat'),
      'and the recurring expense'
    );
    tap := tap || is(
      (select net from tripsplit.trip_member_balances where trip_id = trip and user_id = c),
      carl_net,
      'the new member''s balance is exactly the named person''s'
    );
    tap := tap || ok(
      not exists (select 1 from tripsplit.profiles where id = carl)
      and (select status::text from tripsplit.trip_invitations where token = invite_token) = 'accepted',
      'the named person is gone and the invitation is accepted'
    );

    perform pg_temp.act_as(a);
    gus := tripsplit.add_trip_person(trip, 'Gus');
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name, person_id)
    values (trip, 'gus@test.dev', 'Gus', gus)
    returning token into gus_token;
    perform pg_temp.act_as(b);
    tap := tap || throws_ok(
      format($$ select tripsplit.accept_invitation_link(%L) $$, gus_token),
      'P0001', 'already_on_trip',
      'someone already on the trip can''t take a named person''s place'
    );

    -- -------------------------------------------------------------------------
    -- Deleting the trip deletes its named people
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    delete from tripsplit.trips where id = trip;
    perform pg_temp.act_as_postgres();
    tap := tap || is(
      (select count(*)::int from tripsplit.profiles where guest_trip_id = trip),
      0,
      'deleting the trip removes the people added to it by name'
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
