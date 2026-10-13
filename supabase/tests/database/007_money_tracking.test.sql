-- =============================================================================
-- TripSplit · Money tracking tests (pgTAP): payment methods, offline client
-- ids, rollover, default budget, private incomes, "my share" views, recurring
-- expenses (automatic posting, reminders, skipping, guards).
--
-- Same pattern as 001–006: one function, everything rolled back, TAP output
-- returned as one result set.
--
-- Cast: owner A, housemate B, outsider O (has a budget of their own).
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
  a constant uuid := 'a9000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b9000000-0000-4000-8000-00000000000b';
  o constant uuid := 'c9000000-0000-4000-8000-00000000000c';
  budget constant uuid := 'a9100000-0000-4000-8000-000000000001';
  other_budget constant uuid := 'a9100000-0000-4000-8000-000000000002';
  client_id constant uuid := 'a9200000-0000-4000-8000-000000000001';
  groceries uuid;
  bills uuid;
  other_cat uuid;
  auto_id uuid;
  remind_id uuid;
  other_template uuid;
  this_month date := date_trunc('month', current_date)::date;
  saved uuid;
begin
  begin
    create extension if not exists pgtap with schema extensions;
    tap := tap || plan(24);

    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'p9-owner@test.dev',    '{"full_name":"Ana Owner"}'),
      (b, 'p9-housemate@test.dev', '{"full_name":"Ben Housemate"}'),
      (o, 'p9-outsider@test.dev',  '{"full_name":"Olga Outsider"}');
    perform pg_temp.act_as(b); perform tripsplit.ensure_profile();
    perform pg_temp.act_as(o); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, kind, name, start_date, budget, currency)
    values (other_budget, 'budget', 'Olga Home', this_month, 5000, 'PHP');
    select id into other_cat from tripsplit.categories where trip_id = other_budget and name = 'Groceries';

    perform pg_temp.act_as(a); perform tripsplit.ensure_profile();
    insert into tripsplit.trips (id, kind, name, start_date, budget, currency)
    values (budget, 'budget', 'Household', (this_month - interval '3 months')::date, 20000, 'PHP');
    select id into groceries from tripsplit.categories where trip_id = budget and name = 'Groceries';
    select id into bills from tripsplit.categories where trip_id = budget and name = 'Bills & utilities';
    perform pg_temp.act_as_postgres();
    insert into tripsplit.trip_members (trip_id, user_id) values (budget, b);

    -- -------------------------------------------------------------------------
    -- Payment method and offline client ids
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    saved := tripsplit.save_expense(
      jsonb_build_object('trip_id', budget, 'category_id', groceries, 'description', 'Market', 'amount', '800',
                         'currency', 'PHP', 'paid_by', a, 'payment_method', 'gcash'),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '400.00'),
                        jsonb_build_object('user_id', b, 'split_type', 'equal', 'amount', '400.00')));
    tap := tap || is(
      (select payment_method::text from tripsplit.expenses where id = saved),
      'gcash',
      'an expense records how it was paid'
    );
    tap := tap || lives_ok(
      format($$ update tripsplit.expenses set payment_method = 'maya' where id = %L $$, saved),
      'Maya is a payment method, and it can be changed later'
    );

    tap := tap || is(
      tripsplit.save_expense(
        jsonb_build_object('client_id', client_id, 'trip_id', budget, 'category_id', groceries, 'description', 'Offline bread',
                           'amount', '120', 'currency', 'PHP', 'paid_by', a, 'payment_method', 'cash'),
        jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '120.00'))),
      client_id,
      'an offline save keeps the id the phone gave it'
    );
    tap := tap || is(
      tripsplit.save_expense(
        jsonb_build_object('client_id', client_id, 'trip_id', budget, 'category_id', groceries, 'description', 'Offline bread',
                           'amount', '120', 'currency', 'PHP', 'paid_by', a),
        jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'equal', 'amount', '120.00'))),
      client_id,
      'a retried sync returns the same expense'
    );
    tap := tap || is(
      (select count(*)::int from tripsplit.expenses where id = client_id)
        + (select count(*)::int from tripsplit.expense_splits where expense_id = client_id),
      2,
      '…without creating a duplicate expense or splits'
    );

    -- -------------------------------------------------------------------------
    -- Rollover and default budget
    -- -------------------------------------------------------------------------
    tap := tap || lives_ok(
      format($$ update tripsplit.trips set rollover = true where id = %L $$, budget),
      'the owner can turn on rollover'
    );
    tap := tap || lives_ok(
      format($$ update tripsplit.profiles set default_trip_id = %L where id = %L $$, budget, a),
      'you can choose a default budget for quick add'
    );

    -- -------------------------------------------------------------------------
    -- Private income
    -- -------------------------------------------------------------------------
    insert into tripsplit.incomes (amount, currency, source) values (45000, 'PHP', 'Salary');
    tap := tap || is(
      (select count(*)::int from tripsplit.incomes where user_id = a),
      1,
      'you can record income'
    );
    tap := tap || throws_ok(
      $$ insert into tripsplit.incomes (amount, currency, source) values (1000.5, 'JPY', 'Gift') $$,
      'P0001', 'amount_precision',
      'income amounts respect the currency''s decimals'
    );
    perform pg_temp.act_as(b);
    tap := tap || is_empty(
      'select 1 from tripsplit.incomes',
      'nobody else can see your income, even on a shared budget'
    );
    tap := tap || throws_ok(
      format($$ insert into tripsplit.incomes (user_id, amount, currency, source) values (%L, 1, 'PHP', 'Fake') $$, a),
      '42501', null,
      'you can''t record income for someone else'
    );

    -- -------------------------------------------------------------------------
    -- My share views
    -- -------------------------------------------------------------------------
    tap := tap || is(
      (select string_agg(description || '=' || my_share::text, ',' order by description) from tripsplit.my_expense_shares),
      'Market=400.00',
      'my_expense_shares lists only my share of the expenses I''m in'
    );
    perform pg_temp.act_as(o);
    tap := tap || is_empty(
      format($$ select 1 from tripsplit.trip_category_month_totals where trip_id = %L $$, budget),
      'outsiders see no category totals'
    );

    -- -------------------------------------------------------------------------
    -- Recurring: automatic
    -- -------------------------------------------------------------------------
    perform pg_temp.act_as(a);
    insert into tripsplit.recurring_expenses
      (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month, mode, starts_on, payment_method)
    values
      (budget, bills, 'Internet', 1000.01, a, array[a, b], 1, 'auto', (this_month - interval '2 months')::date, 'card')
    returning id into auto_id;

    perform pg_temp.act_as(b);
    tap := tap || is(tripsplit.post_due_recurring(budget), 3, 'due months are added automatically (two past + this one)');
    tap := tap || is(tripsplit.post_due_recurring(null), 0, 'running it again adds nothing');
    tap := tap || is(
      (select string_agg(s.amount::text, '/' order by s.amount)
       from tripsplit.expense_splits s join tripsplit.expenses e on e.id = s.expense_id
       where e.recurring_id = auto_id and e.recurring_period = this_month),
      '500.00/500.01',
      'an automatic expense is split equally, to the cent'
    );
    tap := tap || is(
      (select payment_method::text || ' ' || created_by::text || ' ' || expense_date::text
       from tripsplit.expenses where recurring_id = auto_id and recurring_period = this_month),
      'card ' || a::text || ' ' || this_month::text,
      'it keeps the payment method, creator and day of the month'
    );

    -- -------------------------------------------------------------------------
    -- Recurring: reminders
    -- -------------------------------------------------------------------------
    insert into tripsplit.recurring_expenses
      (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month, mode)
    values (budget, bills, 'Electricity', 3000, b, array[a, b], 1, 'remind')
    returning id into remind_id;
    perform tripsplit.post_due_recurring(budget);
    tap := tap || is_empty(
      format($$ select 1 from tripsplit.expenses where recurring_id = %L $$, remind_id),
      'reminders are never added automatically'
    );
    perform tripsplit.save_expense(
      jsonb_build_object('trip_id', budget, 'category_id', bills, 'description', 'Electricity', 'amount', '3125.50',
                         'currency', 'PHP', 'paid_by', b, 'recurring_id', remind_id, 'recurring_period', current_date),
      jsonb_build_array(jsonb_build_object('user_id', a, 'split_type', 'custom', 'value', '1562.75', 'amount', '1562.75'),
                        jsonb_build_object('user_id', b, 'split_type', 'custom', 'value', '1562.75', 'amount', '1562.75')));
    tap := tap || is(
      (select last_period from tripsplit.recurring_expenses where id = remind_id),
      this_month,
      'adding the real bill settles this month''s reminder'
    );
    tap := tap || lives_ok(
      format($$ select tripsplit.skip_recurring(%L, %L) $$, remind_id, (this_month + interval '1 month')::date),
      'a reminder can be skipped'
    );

    perform pg_temp.act_as(o);
    insert into tripsplit.recurring_expenses (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month)
    values (other_budget, other_cat, 'Water', 500, o, array[o], 5) returning id into other_template;
    tap := tap || throws_ok(
      format($$ select tripsplit.skip_recurring(%L, current_date) $$, remind_id),
      'P0001', 'not_permitted',
      'outsiders can''t skip someone else''s reminders'
    );
    tap := tap || is_empty(
      format($$ select 1 from tripsplit.recurring_expenses where trip_id = %L $$, budget),
      'outsiders can''t see a budget''s recurring expenses'
    );

    perform pg_temp.act_as(a);
    tap := tap || throws_ok(
      format($$ select tripsplit.save_expense(
        jsonb_build_object('trip_id', %L, 'category_id', %L, 'description', 'Sneaky', 'amount', '10', 'currency', 'PHP',
                           'paid_by', %L, 'recurring_id', %L, 'recurring_period', current_date),
        jsonb_build_array(jsonb_build_object('user_id', %L, 'split_type', 'equal', 'amount', '10.00'))) $$,
        budget, groceries, a, other_template, a),
      'P0001', 'not_permitted',
      'an expense can''t claim another budget''s recurring template'
    );
    tap := tap || throws_ok(
      format($$ insert into tripsplit.recurring_expenses (trip_id, category_id, description, amount, paid_by, participant_ids, day_of_month)
                values (%L, %L, 'Rent', 9000, %L, array[%L]::uuid[], 30) $$, budget, bills, o, a),
      'P0001', 'payer_not_member',
      'a recurring expense must be paid by a member'
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
