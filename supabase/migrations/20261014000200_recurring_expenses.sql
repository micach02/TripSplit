-- =============================================================================
-- TripSplit · Recurring expenses (rent, bills, subscriptions)
--
-- A template on a budget or trip repeats monthly on a day of the month, in the
-- trip currency, split equally between chosen members.
--
--   mode 'auto'   → the expense is added by itself. There's no scheduler on a
--                   shared project, so due expenses are posted when a member
--                   opens the app: tripsplit.post_due_recurring().
--   mode 'remind' → the app shows "due" reminders; adding one (save_expense
--                   with recurring_id/recurring_period) or skipping it moves on.
--
-- Each (template, month) can only ever produce one expense: a unique index on
-- expenses (recurring_id, recurring_period) makes posting idempotent.
--
-- save_expense also learns:
--   * payment_method
--   * client_id — offline saves create the expense with the phone's id; a
--     retried sync finds it already there and returns it unchanged
--   * recurring_id / recurring_period — "add" from a reminder
-- =============================================================================

create type tripsplit.recurring_mode as enum ('auto', 'remind');

create table tripsplit.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references tripsplit.trips (id) on delete cascade,
  category_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  -- In the trip currency
  amount numeric(14, 2) not null check (amount > 0),
  paid_by uuid not null references tripsplit.profiles (id),
  participant_ids uuid[] not null check (cardinality(participant_ids) > 0),
  payment_method tripsplit.payment_method,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  mode tripsplit.recurring_mode not null default 'remind',
  starts_on date not null default current_date,
  -- First day of the latest month already added or skipped
  last_period date,
  active boolean not null default true,
  created_by uuid default auth.uid() references tripsplit.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_category_fkey foreign key (category_id, trip_id)
    references tripsplit.categories (id, trip_id)
);

create index recurring_expenses_trip_id_idx on tripsplit.recurring_expenses (trip_id);
create index recurring_expenses_paid_by_idx on tripsplit.recurring_expenses (paid_by);
create index recurring_expenses_created_by_idx on tripsplit.recurring_expenses (created_by);

alter table tripsplit.expenses
  add column recurring_id uuid references tripsplit.recurring_expenses (id) on delete set null,
  add column recurring_period date;

create unique index expenses_recurring_period_key
  on tripsplit.expenses (recurring_id, recurring_period) where recurring_id is not null;

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------
create function tripsplit_private.recurring_expenses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
begin
  select t.currency into v_currency from tripsplit.trips t where t.id = new.trip_id;
  perform tripsplit_private.assert_currency_precision(new.amount, v_currency);

  if not exists (select 1 from tripsplit.trip_members m where m.trip_id = new.trip_id and m.user_id = new.paid_by) then
    raise exception using errcode = 'P0001', message = 'payer_not_member';
  end if;
  if exists (
    select 1 from unnest(new.participant_ids) p(user_id)
    where not exists (select 1 from tripsplit.trip_members m where m.trip_id = new.trip_id and m.user_id = p.user_id)
  ) then
    raise exception using errcode = 'P0001', message = 'participant_not_member';
  end if;

  new.description := btrim(new.description);
  new.participant_ids := array(select distinct unnest(new.participant_ids));
  new.updated_at := now();
  return new;
end;
$$;

create trigger recurring_expenses_before_write
  before insert or update on tripsplit.recurring_expenses
  for each row execute function tripsplit_private.recurring_expenses_before_write();

-- -----------------------------------------------------------------------------
-- Access: members see and create; the creator or the owner edit and delete
-- -----------------------------------------------------------------------------
alter table tripsplit.recurring_expenses enable row level security;

create policy "Members can view recurring expenses"
  on tripsplit.recurring_expenses for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Members can create recurring expenses"
  on tripsplit.recurring_expenses for insert to authenticated
  with check (tripsplit_private.is_trip_member(trip_id) and created_by = (select auth.uid()));

create policy "Creators and owners can change recurring expenses"
  on tripsplit.recurring_expenses for update to authenticated
  using (created_by = (select auth.uid()) or tripsplit_private.is_trip_owner(trip_id))
  with check (tripsplit_private.is_trip_member(trip_id));

create policy "Creators and owners can delete recurring expenses"
  on tripsplit.recurring_expenses for delete to authenticated
  using (created_by = (select auth.uid()) or tripsplit_private.is_trip_owner(trip_id));

grant select, insert, delete on tripsplit.recurring_expenses to authenticated;
grant update (category_id, description, amount, paid_by, participant_ids, payment_method, day_of_month, mode, active)
  on tripsplit.recurring_expenses to authenticated;
grant all on tripsplit.recurring_expenses to service_role;

-- -----------------------------------------------------------------------------
-- Dates: the occurrence in a month, clamped to the month's last day (31 → 30/28)
-- -----------------------------------------------------------------------------
create function tripsplit_private.recurring_date(p_period date, p_day smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_period + (least(p_day::integer,
    extract(day from (date_trunc('month', p_period) + interval '1 month - 1 day'))::integer) - 1))::date;
$$;

-- Moves a template past a month (added or skipped); never backwards.
create function tripsplit_private.mark_recurring_period(p_recurring_id uuid, p_period date)
returns void
language sql
security definer
set search_path = ''
as $$
  update tripsplit.recurring_expenses
  set last_period = greatest(coalesce(last_period, p_period), p_period)
  where id = p_recurring_id;
$$;

-- An expense added from a reminder settles that month for its template.
create function tripsplit_private.expenses_after_insert_recurring()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recurring_id is not null and new.recurring_period is not null and exists (
    select 1 from tripsplit.recurring_expenses r where r.id = new.recurring_id and r.trip_id = new.trip_id
  ) then
    perform tripsplit_private.mark_recurring_period(new.recurring_id, new.recurring_period);
  end if;
  return null;
end;
$$;

create trigger expenses_after_insert_recurring
  after insert on tripsplit.expenses
  for each row execute function tripsplit_private.expenses_after_insert_recurring();

-- -----------------------------------------------------------------------------
-- Post one month of an automatic template: equal split between the
-- participants who are still members, remainder cents to the later entries
-- (the app's allocation rule). Returns true when an expense was created.
-- -----------------------------------------------------------------------------
create function tripsplit_private.post_recurring_expense(p_template tripsplit.recurring_expenses, p_period date, p_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip tripsplit.trips;
  v_people uuid[];
  v_decimals integer;
  v_minor bigint;
  v_count integer;
  v_base bigint;
  v_extra bigint;
  v_expense_id uuid;
begin
  select * into v_trip from tripsplit.trips t where t.id = p_template.trip_id;
  if not exists (select 1 from tripsplit.trip_members m where m.trip_id = v_trip.id and m.user_id = p_template.paid_by) then
    return false;
  end if;

  select array_agg(p.user_id order by p.ord) into v_people
  from unnest(p_template.participant_ids) with ordinality p(user_id, ord)
  where exists (select 1 from tripsplit.trip_members m where m.trip_id = v_trip.id and m.user_id = p.user_id);
  if v_people is null then
    v_people := array[p_template.paid_by];
  end if;

  v_decimals := tripsplit_private.currency_decimals(v_trip.currency);
  v_minor := round(p_template.amount * power(10, v_decimals))::bigint;
  v_count := cardinality(v_people);
  v_base := v_minor / v_count;
  v_extra := v_minor - v_base * v_count;

  insert into tripsplit.expenses (
    trip_id, category_id, description, amount, currency, exchange_rate, paid_by, expense_date,
    payment_method, created_by, recurring_id, recurring_period
  )
  values (
    v_trip.id, p_template.category_id, p_template.description, p_template.amount, v_trip.currency, 1,
    p_template.paid_by, p_date, p_template.payment_method, p_template.created_by, p_template.id, p_period
  )
  on conflict (recurring_id, recurring_period) where recurring_id is not null do nothing
  returning id into v_expense_id;

  if v_expense_id is null then
    return false;
  end if;

  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount)
  select v_expense_id,
         p.user_id,
         'equal',
         null,
         ((v_base + case when p.ord > v_count - v_extra then 1 else 0 end)::numeric / power(10, v_decimals))
  from unnest(v_people) with ordinality p(user_id, ord);

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Add every automatic expense that has come due (one trip, or all of mine).
-- Returns how many expenses were added. At most 24 months per template per call.
-- -----------------------------------------------------------------------------
create function tripsplit.post_due_recurring(p_trip_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r tripsplit.recurring_expenses;
  v_period date;
  v_date date;
  v_steps integer;
  v_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check deferred;

  for r in
    select x.*
    from tripsplit.recurring_expenses x
    where x.active
      and x.mode = 'auto'
      and (p_trip_id is null or x.trip_id = p_trip_id)
      and tripsplit_private.is_trip_member(x.trip_id)
      and exists (select 1 from tripsplit.trips t where t.id = x.trip_id and t.status <> 'completed')
    order by x.created_at
    for update
  loop
    v_period := case
      when r.last_period is null then date_trunc('month', r.starts_on)::date
      else (r.last_period + interval '1 month')::date
    end;
    v_steps := 0;
    loop
      v_date := tripsplit_private.recurring_date(v_period, r.day_of_month);
      exit when v_date > current_date or v_steps >= 24;
      if v_date >= r.starts_on and tripsplit_private.post_recurring_expense(r, v_period, v_date) then
        v_count := v_count + 1;
      end if;
      perform tripsplit_private.mark_recurring_period(r.id, v_period);
      v_period := (v_period + interval '1 month')::date;
      v_steps := v_steps + 1;
    end loop;
  end loop;

  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check immediate;
  return v_count;
end;
$$;

-- Skip a month of a reminder ("not this time").
create function tripsplit.skip_recurring(p_recurring_id uuid, p_period date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from tripsplit.recurring_expenses r
    where r.id = p_recurring_id and tripsplit_private.is_trip_member(r.trip_id)
  ) then
    raise exception using errcode = 'P0001', message = 'not_permitted';
  end if;
  perform tripsplit_private.mark_recurring_period(p_recurring_id, date_trunc('month', p_period)::date);
end;
$$;

-- -----------------------------------------------------------------------------
-- save_expense: payment method, offline client ids, adding from a reminder
-- -----------------------------------------------------------------------------
create or replace function tripsplit.save_expense(p_expense jsonb, p_splits jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_expense ->> 'id', '')::uuid;
  v_client_id uuid := nullif(p_expense ->> 'client_id', '')::uuid;
  v_trip_id uuid := (p_expense ->> 'trip_id')::uuid;
  v_amount numeric := (p_expense ->> 'amount')::numeric;
  v_payment tripsplit.payment_method := nullif(p_expense ->> 'payment_method', '')::tripsplit.payment_method;
  v_recurring_id uuid := nullif(p_expense ->> 'recurring_id', '')::uuid;
  v_recurring_period date := date_trunc('month', nullif(p_expense ->> 'recurring_period', '')::date)::date;
  v_type_count integer;
  v_type_text text;
  v_split_type tripsplit.split_type;
  v_value_total numeric;
  v_value_min numeric;
begin
  -- An offline save that already reached the server: nothing to do.
  if v_id is null and v_client_id is not null
     and exists (select 1 from tripsplit.expenses e where e.id = v_client_id) then
    return v_client_id;
  end if;

  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check deferred;

  -- A reminder can only be settled by an expense on its own budget or trip.
  if v_recurring_id is not null and not exists (
    select 1 from tripsplit.recurring_expenses r where r.id = v_recurring_id and r.trip_id = v_trip_id
  ) then
    raise exception using errcode = 'P0001', message = 'not_permitted';
  end if;

  if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception using errcode = 'P0001', message = 'expense_requires_participant';
  end if;

  select count(distinct s ->> 'split_type'),
         min(s ->> 'split_type'),
         sum(nullif(s ->> 'value', '')::numeric),
         min(nullif(s ->> 'value', '')::numeric)
  into v_type_count, v_type_text, v_value_total, v_value_min
  from jsonb_array_elements(p_splits) s;

  if v_type_count <> 1 then
    raise exception using errcode = 'P0001', message = 'invalid_split';
  end if;
  v_split_type := v_type_text::tripsplit.split_type;

  if v_split_type = 'percentage' and v_value_total is distinct from 100 then
    raise exception using errcode = 'P0001', message = 'split_percentage_total';
  end if;
  if v_split_type = 'custom' and v_value_total is distinct from v_amount then
    raise exception using errcode = 'P0001', message = 'split_custom_total';
  end if;
  if v_split_type = 'shares' and (v_value_min is null or v_value_min <= 0) then
    raise exception using errcode = 'P0001', message = 'invalid_split_value';
  end if;

  if v_id is null then
    insert into tripsplit.expenses (
      id, trip_id, category_id, description, amount, currency, exchange_rate, paid_by, expense_date, notes,
      payment_method, recurring_id, recurring_period
    )
    values (
      coalesce(v_client_id, gen_random_uuid()),
      v_trip_id,
      (p_expense ->> 'category_id')::uuid,
      btrim(p_expense ->> 'description'),
      v_amount,
      p_expense ->> 'currency',
      coalesce(nullif(p_expense ->> 'exchange_rate', '')::numeric, 1),
      (p_expense ->> 'paid_by')::uuid,
      coalesce(nullif(p_expense ->> 'expense_date', '')::date, current_date),
      nullif(btrim(p_expense ->> 'notes'), ''),
      v_payment,
      v_recurring_id,
      case when v_recurring_id is null then null else v_recurring_period end
    )
    returning id into v_id;
  else
    update tripsplit.expenses
    set category_id = (p_expense ->> 'category_id')::uuid,
        description = btrim(p_expense ->> 'description'),
        amount = v_amount,
        currency = p_expense ->> 'currency',
        exchange_rate = coalesce(nullif(p_expense ->> 'exchange_rate', '')::numeric, 1),
        paid_by = (p_expense ->> 'paid_by')::uuid,
        expense_date = coalesce(nullif(p_expense ->> 'expense_date', '')::date, current_date),
        notes = nullif(btrim(p_expense ->> 'notes'), ''),
        payment_method = v_payment
    where id = v_id and trip_id = v_trip_id;

    if not found then
      raise exception using errcode = '42501', message = 'expense_not_editable';
    end if;

    delete from tripsplit.expense_splits where expense_id = v_id;
  end if;

  insert into tripsplit.expense_splits (expense_id, user_id, split_type, value, amount)
  select v_id,
         (s ->> 'user_id')::uuid,
         v_split_type,
         nullif(s ->> 'value', '')::numeric,
         (s ->> 'amount')::numeric
  from jsonb_array_elements(p_splits) s;

  -- Validate the totals now so the error comes back from this call.
  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check immediate;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function
  tripsplit_private.recurring_expenses_before_write(),
  tripsplit_private.recurring_date(date, smallint),
  tripsplit_private.mark_recurring_period(uuid, date),
  tripsplit_private.expenses_after_insert_recurring(),
  tripsplit_private.post_recurring_expense(tripsplit.recurring_expenses, date, date),
  tripsplit.post_due_recurring(uuid),
  tripsplit.skip_recurring(uuid, date)
from public;

grant execute on function
  tripsplit.post_due_recurring(uuid),
  tripsplit.skip_recurring(uuid, date)
to authenticated, service_role;

grant execute on function
  tripsplit_private.recurring_expenses_before_write(),
  tripsplit_private.recurring_date(date, smallint),
  tripsplit_private.mark_recurring_period(uuid, date),
  tripsplit_private.expenses_after_insert_recurring(),
  tripsplit_private.post_recurring_expense(tripsplit.recurring_expenses, date, date)
to service_role;
