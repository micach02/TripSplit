-- =============================================================================
-- TripSplit · Phase 6 tests (pgTAP): receipt storage, invite links,
-- expense participants.
--
-- Same pattern as 001–003: one function, everything rolled back, TAP output
-- returned as one result set.
--
-- Cast: owner A, member B (pays), member C (no edit rights), outsider D,
-- link users F and G.
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

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function pg_temp.tripsplit_tests() returns setof text language plpgsql as $tests$
declare
  tap text[] := '{}';
  a constant uuid := 'a6000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b6000000-0000-4000-8000-00000000000b';
  c constant uuid := 'c6000000-0000-4000-8000-00000000000c';
  d constant uuid := 'd6000000-0000-4000-8000-00000000000d';
  f constant uuid := 'f6000000-0000-4000-8000-00000000000f';
  g constant uuid := 'e6000000-0000-4000-8000-00000000000e';
  trip constant uuid := 'a6100000-0000-4000-8000-000000000001';
  food uuid;
  expense uuid;
  other_expense uuid;
  token1 uuid;
  token2 uuid;
  token3 uuid;
  receipt text;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(28);

    -- -------------------------------------------------------------------------
    -- Fixtures
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p6-owner@test.dev',    '{"full_name":"Olivia Owner"}'),
      (b, 'p6-payer@test.dev',    '{"full_name":"Paul Payer"}'),
      (c, 'p6-member@test.dev',   '{"full_name":"Mia Member"}'),
      (d, 'p6-outsider@test.dev', '{"full_name":"Oscar Outsider"}'),
      (f, 'p6-linkuser@test.dev', '{"full_name":"Lina Link"}'),
      (g, 'p6-other@test.dev',    '{"full_name":"Gabe Guest"}');
    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (trip, 'Receipts Trip', '2026-11-03', '2026-11-08', 20000, 'PHP');
    select id into food from tripsplit.categories where trip_id = trip and name = 'Food';
    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(c); perform tripsplit.ensure_profile();
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, b), (trip, c);

    perform pg_temp.act_as(b);
    expense := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Dinner', 'amount', '1000', 'currency', 'PHP', 'paid_by', b),
      jsonb_build_array(
        jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '500.00'),
        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '500.00')));
    receipt := trip::text || '/' || expense::text || '/receipt-1.jpg';

    -- -------------------------------------------------------------------------
    -- Receipt storage
    -- -------------------------------------------------------------------------
    tap := tap || lives_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-receipts', %L) $$, receipt),
      'the expense creator can upload its receipt'
    );
    perform pg_temp.act_as(a);
    tap := tap || lives_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-receipts', %L) $$,
             trip::text || '/' || expense::text || '/receipt-owner.jpg'),
      'the trip owner can upload a receipt for any expense'
    );
    perform pg_temp.act_as(c);
    tap := tap || throws_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-receipts', %L) $$,
             trip::text || '/' || expense::text || '/sneaky.jpg'),
      '42501', null,
      'members who cannot edit the expense cannot upload its receipt'
    );
    tap := tap || isnt_empty(
      format($$ select id from storage.objects where bucket_id = 'tripsplit-receipts' and name = %L $$, receipt),
      'every trip member can view receipts'
    );
    perform pg_temp.act_as(d);
    tap := tap || is_empty(
      format($$ select id from storage.objects where bucket_id = 'tripsplit-receipts' and name = %L $$, receipt),
      'outsiders cannot view receipts'
    );
    perform pg_temp.act_as(b);
    tap := tap || throws_ok(
      format($$ insert into storage.objects (bucket_id, name) values ('tripsplit-receipts', %L) $$,
             gen_random_uuid()::text || '/' || expense::text || '/wrong-trip.jpg'),
      '42501', null,
      'a receipt path must name the expense''s own trip'
    );
    tap := tap || is(
      tripsplit_private.path_uuid('not-a-uuid/x.jpg', 1),
      null::uuid,
      'malformed receipt paths map to nothing'
    );

    tap := tap || lives_ok(
      format($$ update tripsplit.expenses set receipt_url = %L where id = %L $$, receipt, expense),
      'an expense can point at a receipt in its own folder'
    );
    perform pg_temp.act_as(a);
    other_expense := tripsplit.save_expense(
      jsonb_build_object('trip_id', trip, 'category_id', food, 'description', 'Taxi', 'amount', '200', 'currency', 'PHP', 'paid_by', b),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '200.00')));
    tap := tap || throws_ok(
      format($$ update tripsplit.expenses set receipt_url = %L where id = %L $$, receipt, other_expense),
      'P0001', 'invalid_receipt_path',
      'an expense cannot borrow another expense''s receipt'
    );

    -- -------------------------------------------------------------------------
    -- Expense participants (payer + everyone with a share)
    -- -------------------------------------------------------------------------
    tap := tap || is(
      (select participant_ids from tripsplit.expenses where id = expense),
      (select array_agg(x order by x) from unnest(array[a, b]) x),
      'participants are the payer and everyone sharing'
    );
    tap := tap || is(
      (select participant_ids from tripsplit.expenses where id = other_expense),
      (select array_agg(x order by x) from unnest(array[a, b]) x),
      'a payer who is not sharing still counts as involved'
    );
    tap := tap || lives_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('id', %L::uuid, 'trip_id', %L::uuid, 'category_id', %L::uuid, 'description', 'Taxi', 'amount', '200', 'currency', 'PHP', 'paid_by', %L::uuid),
        jsonb_build_array(jsonb_build_object('user_id', %L::uuid, 'split_type', 'equal', 'amount', '200.00'))) $$,
        other_expense, trip, food, a, a),
      'editing an expense re-saves its participants'
    );
    tap := tap || is(
      (select participant_ids from tripsplit.expenses where id = other_expense),
      array[a],
      'participants follow the payer and the split'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.expenses where trip_id = trip and participant_ids @> array[b]),
      1,
      'the "involving" filter finds only expenses a person is part of'
    );
    tap := tap || throws_ok(
      format($$ update tripsplit.expenses set participant_ids = '{}' where id = %L $$, expense),
      '42501', null,
      'participants cannot be edited directly'
    );

    -- -------------------------------------------------------------------------
    -- Invite links
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name)
    values (trip, 'friend@test.dev', 'Friend') returning token into token1;
    tap := tap || isnt(token1, null::uuid, 'every invitation gets a link token');
    tap := tap || throws_ok(
      format($$ update tripsplit.trip_invitations set token = gen_random_uuid() where token = %L $$, token1),
      '42501', null,
      'link tokens cannot be changed by clients'
    );

    perform pg_temp.act_as(f);
    tap := tap || is(
      (select trip_name || ' / ' || invited_by_name || ' / ' || status || ' / ' || already_member::text
       from tripsplit.get_invitation_preview(token1)),
      'Receipts Trip / Olivia Owner / pending / false',
      'anyone signed in with the link can preview the invitation'
    );
    tap := tap || is_empty(
      format($$ select * from tripsplit.get_invitation_preview(%L) $$, gen_random_uuid()),
      'an unknown link shows nothing'
    );
    tap := tap || is(tripsplit.accept_invitation_link(token1), trip, 'accepting a link joins the trip');
    tap := tap || isnt_empty(
      format($$ select id from tripsplit.trips where id = %L $$, trip),
      'after joining by link, the trip is visible'
    );
    tap := tap || is(tripsplit.accept_invitation_link(token1), trip, 'opening the link again just returns the trip');

    perform pg_temp.act_as(g);
    tap := tap || throws_ok(
      format($$ select tripsplit.accept_invitation_link(%L) $$, token1),
      'P0001', 'invitation_not_pending',
      'a used link cannot be used by someone else'
    );

    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'late@test.dev') returning token into token2;
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'nope@test.dev') returning token into token3;
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set expires_at = now() - interval '1 minute' where token = token2;

    perform pg_temp.act_as(g);
    tap := tap || is(
      (select status from tripsplit.get_invitation_preview(token2)),
      'expired',
      'an expired link previews as expired'
    );
    tap := tap || throws_ok(
      format($$ select tripsplit.accept_invitation_link(%L) $$, token2),
      'P0001', 'invitation_expired',
      'an expired link cannot be accepted'
    );
    tap := tap || lives_ok(
      format($$ select tripsplit.decline_invitation_link(%L) $$, token3),
      'a link can be declined'
    );
    tap := tap || is_empty(
      format($$ select id from tripsplit.trips where id = %L $$, trip),
      'declining does not join the trip'
    );

    perform pg_temp.act_as_anon();
    tap := tap || throws_ok(
      format($$ select * from tripsplit.get_invitation_preview(%L) $$, token1),
      '42501', null,
      'anonymous visitors cannot preview invitations'
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
