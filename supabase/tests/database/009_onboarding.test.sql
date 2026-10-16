-- =============================================================================
-- TripSplit · Onboarding tests (pgTAP): new profiles start un-onboarded, people
-- can mark only their own profile as onboarded.
--
-- Same pattern as 001–008: one function, everything rolled back, TAP output
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

create function pg_temp.tripsplit_tests() returns setof text language plpgsql as $tests$
declare
  tap text[] := '{}';
  a constant uuid := 'a0900000-0000-4000-8000-00000000000a';
  b constant uuid := 'b0900000-0000-4000-8000-00000000000b';
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(3);

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'ob-a@test.dev', '{"full_name":"Ana New"}'),
      (b, 'ob-b@test.dev', '{"full_name":"Ben New"}');
    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(a);

    tap := tap || is(
      (tripsplit.ensure_profile()).onboarded_at,
      null::timestamptz,
      'a new account hasn''t been onboarded yet'
    );

    update tripsplit.profiles set onboarded_at = now() where id = a;
    tap := tap || isnt(
      (select onboarded_at from tripsplit.profiles where id = a),
      null::timestamptz,
      'people can mark their own welcome as done'
    );

    update tripsplit.profiles set onboarded_at = now() where id = b;
    perform set_config('role', 'none', true);
    tap := tap || is(
      (select onboarded_at from tripsplit.profiles where id = b),
      null::timestamptz,
      'but not someone else''s'
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
