-- =============================================================================
-- TripSplit · Phase 7 tests (pgTAP): invitation lifecycle — status changes only
-- through functions, renewing (new expiry + new link), and joining closing
-- the person's other pending invitations.
--
-- Same pattern as 001–004: one function, everything rolled back, TAP output
-- returned as one result set.
--
-- Cast: owner A, member M, invitee E, stranger S (declines), link user L.
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
  a constant uuid := 'a7000000-0000-4000-8000-00000000000a';
  m constant uuid := 'b7000000-0000-4000-8000-00000000000b';
  e constant uuid := 'c7000000-0000-4000-8000-00000000000c';
  s constant uuid := 'd7000000-0000-4000-8000-00000000000d';
  l constant uuid := 'e7000000-0000-4000-8000-00000000000e';
  trip constant uuid := 'a7100000-0000-4000-8000-000000000001';
  inv_e uuid;
  token_e uuid;
  renewed tripsplit.trip_invitations;
  inv_s uuid;
  inv_l uuid;
  link_token uuid;
  twice_old uuid;
  lapse_old uuid;
  lapse_new uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(22);

    -- -------------------------------------------------------------------------
    -- Fixtures
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p7-owner@test.dev',    '{"full_name":"Olga Owner"}'),
      (m, 'p7-member@test.dev',   '{"full_name":"Max Member"}'),
      (e, 'p7-invitee@test.dev',  '{"full_name":"Eve Invitee"}'),
      (s, 'p7-stranger@test.dev', '{"full_name":"Sam Stranger"}'),
      (l, 'p7-link@test.dev',     '{"full_name":"Leo Link"}');
    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, name, start_date, end_date, budget, currency)
    values (trip, 'Invites Trip', '2026-12-01', '2026-12-05', 10000, 'PHP');
    perform pg_temp.act_as(m); perform tripsplit.ensure_profile();
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (trip, m);

    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name)
    values (trip, 'p7-invitee@test.dev', 'Eve') returning id, token into inv_e, token_e;

    -- -------------------------------------------------------------------------
    -- Status changes only through functions
    -- -------------------------------------------------------------------------
    tap := tap || throws_ok(
      format($$ update tripsplit.trip_invitations set expires_at = now() + interval '1 year' where id = %L $$, inv_e),
      '42501', null,
      'owners cannot stretch an expiry by editing the row'
    );
    tap := tap || throws_ok(
      format($$ update tripsplit.trip_invitations set status = 'accepted' where id = %L $$, inv_e),
      '42501', null,
      'owners cannot mark an invitation accepted'
    );
    perform pg_temp.act_as(e);
    tap := tap || throws_ok(
      format($$ update tripsplit.trip_invitations set status = 'accepted' where id = %L $$, inv_e),
      '42501', null,
      'invitees cannot accept by editing the row'
    );

    -- -------------------------------------------------------------------------
    -- Renewing an expired invitation
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set expires_at = now() - interval '1 day' where id = inv_e;

    perform pg_temp.act_as(e);
    tap := tap || throws_ok(
      format($$ select tripsplit.accept_invitation(%L) $$, inv_e),
      'P0001', 'invitation_expired',
      'an expired invitation cannot be accepted'
    );

    perform pg_temp.act_as(m);
    tap := tap || throws_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, inv_e),
      'P0001', 'invitation_not_found',
      'members who are not the owner cannot renew'
    );
    perform pg_temp.act_as(s);
    tap := tap || throws_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, inv_e),
      'P0001', 'invitation_not_found',
      'outsiders cannot renew'
    );
    perform pg_temp.act_as_anon();
    tap := tap || throws_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, inv_e),
      '42501', null,
      'anonymous visitors cannot renew'
    );

    perform pg_temp.act_as(a);
    renewed := tripsplit.renew_invitation(inv_e);
    tap := tap || is(renewed.status::text, 'pending', 'renewing makes the invitation pending again');
    tap := tap || ok(
      renewed.expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute',
      'a renewed invitation gets a fresh 7-day window'
    );
    tap := tap || isnt(renewed.token, token_e, 'a renewed invitation gets a new link');

    perform pg_temp.act_as(l);
    tap := tap || is_empty(
      format($$ select * from tripsplit.get_invitation_preview(%L) $$, token_e),
      'the old link stops working'
    );

    perform pg_temp.act_as(e);
    tap := tap || is(
      (select count(*)::int from tripsplit.get_my_invitations() where id = inv_e),
      1,
      'the invitee sees the renewed invitation'
    );
    tap := tap || is(
      tripsplit.accept_invitation(inv_e),
      trip,
      'the renewed invitation can be accepted'
    );

    perform pg_temp.act_as(a);
    tap := tap || throws_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, inv_e),
      'P0001', 'invitation_not_pending',
      'an accepted invitation cannot be renewed'
    );

    -- -------------------------------------------------------------------------
    -- Renewing a declined invitation
    -- -------------------------------------------------------------------------
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'p7-stranger@test.dev')
    returning id into inv_s;
    perform pg_temp.act_as(s);
    perform tripsplit.decline_invitation(inv_s);
    perform pg_temp.act_as(a);
    tap := tap || is(
      (tripsplit.renew_invitation(inv_s)).status::text,
      'pending',
      'a declined invitation can be sent again'
    );
    perform pg_temp.act_as(s);
    tap := tap || is(
      (select count(*)::int from tripsplit.get_my_invitations()),
      1,
      'the person sees it again after it was re-sent'
    );

    -- -------------------------------------------------------------------------
    -- One live invitation per person
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'twice@test.dev')
    returning id into twice_old;
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set status = 'declined' where id = twice_old;
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'twice@test.dev');
    tap := tap || throws_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, twice_old),
      'P0001', 'invitation_already_pending',
      'an old invitation cannot be renewed while a newer one is live'
    );

    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'lapse@test.dev')
    returning id into lapse_old;
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set status = 'declined' where id = lapse_old;
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'lapse@test.dev')
    returning id into lapse_new;
    perform pg_temp.act_as_postgres();
    update tripsplit.trip_invitations set expires_at = now() - interval '1 minute' where id = lapse_new;
    perform pg_temp.act_as(a);
    tap := tap || lives_ok(
      format($$ select tripsplit.renew_invitation(%L) $$, lapse_old),
      'a lapsed newer invitation does not block renewing'
    );
    perform pg_temp.act_as_postgres();
    tap := tap || is(
      (select status::text from tripsplit.trip_invitations where id = lapse_new),
      'expired',
      'the lapsed one is marked expired'
    );

    -- -------------------------------------------------------------------------
    -- Joining closes the person's other pending invitations
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.trip_invitations (trip_id, invited_email) values (trip, 'p7-link@test.dev')
    returning id into inv_l;
    insert into tripsplit.trip_invitations (trip_id, invited_email, invited_name)
    values (trip, 'leo.other@test.dev', 'Leo') returning token into link_token;

    perform pg_temp.act_as(l);
    perform tripsplit.ensure_profile();
    tap := tap || is(tripsplit.accept_invitation_link(link_token), trip, 'Leo joins through a link sent to another address');
    perform pg_temp.act_as_postgres();
    tap := tap || is(
      (select status::text from tripsplit.trip_invitations where id = inv_l),
      'accepted',
      'the email invitation to Leo is closed when he joins'
    );
    perform pg_temp.act_as(l);
    tap := tap || is_empty(
      'select * from tripsplit.get_my_invitations()',
      'Leo has no invitation left to answer'
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
