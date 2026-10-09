-- =============================================================================
-- TripSplit · Change a trip's currency
--
-- The trip currency is normally locked once money is recorded (see
-- trips_before_update). tripsplit.change_trip_currency() lets the OWNER
-- convert an existing trip in one transaction:
--   * budget, category budgets and settlements are multiplied by the rate
--   * every expense keeps its original amount & currency; its exchange rate
--     is re-based onto the new trip currency and converted_amount recomputed
--   * each expense's split amounts are re-spread over the new total in
--     proportion to the old ones (largest-remainder rounding, so they still
--     add up exactly)
-- p_rate = units of the NEW currency per 1 unit of the OLD currency.
-- =============================================================================

-- Allow the lock to be lifted only from inside change_trip_currency().
create or replace function tripsplit_private.trips_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency
     and coalesce(current_setting('tripsplit.allow_currency_change', true), '') <> 'on'
     and (
       exists (select 1 from tripsplit.expenses e where e.trip_id = new.id)
       or exists (select 1 from tripsplit.settlements s where s.trip_id = new.id)
     )
  then
    raise exception using errcode = 'P0001', message = 'trip_currency_locked';
  end if;

  return new;
end;
$$;

-- Re-spreads an expense's split amounts over its current converted total,
-- proportionally to the existing amounts (largest-remainder rounding). Ties
-- are broken consistently by row order, so re-running gives the same result.
create function tripsplit_private.reallocate_expense_splits(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_minor numeric;
  v_scale numeric;
begin
  select e.converted_amount * power(10::numeric, tripsplit_private.currency_decimals(t.currency)),
         power(10::numeric, tripsplit_private.currency_decimals(t.currency))
  into v_total_minor, v_scale
  from tripsplit.expenses e
  join tripsplit.trips t on t.id = e.trip_id
  where e.id = p_expense_id;

  with weights as (
    select s.id,
           -- If every old amount was 0 (can't normally happen), fall back to equal weights.
           case when sum(s.amount) over () = 0 then 1 else s.amount end as weight,
           row_number() over (order by s.created_at, s.id) as position
    from tripsplit.expense_splits s
    where s.expense_id = p_expense_id
  ),
  shares as (
    select w.id,
           w.position,
           floor(v_total_minor * w.weight / sum(w.weight) over ()) as base,
           mod(v_total_minor * w.weight, sum(w.weight) over ()) as remainder
    from weights w
  ),
  ranked as (
    select sh.*,
           row_number() over (order by sh.remainder desc, sh.position desc) as priority,
           v_total_minor - sum(sh.base) over () as leftover
    from shares sh
  )
  update tripsplit.expense_splits s
  set amount = (r.base + case when r.priority <= r.leftover then 1 else 0 end) / v_scale
  from ranked r
  where s.id = r.id;
end;
$$;

create function tripsplit.change_trip_currency(p_trip_id uuid, p_currency text, p_rate numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip tripsplit.trips;
  v_decimals smallint := tripsplit_private.currency_decimals(p_currency);
  v_rate numeric := round(p_rate, 8);
  v_expense_id uuid;
begin
  select * into v_trip from tripsplit.trips t where t.id = p_trip_id for update;
  if not found or v_trip.owner_id is distinct from (select auth.uid()) then
    raise exception using errcode = '42501', message = 'not_permitted';
  end if;
  if v_decimals is null then
    raise exception using errcode = 'P0001', message = 'unsupported_currency';
  end if;
  if p_currency = v_trip.currency then
    return;
  end if;
  if v_rate is null or v_rate <= 0 then
    raise exception using errcode = 'P0001', message = 'invalid_exchange_rate';
  end if;

  perform set_config('tripsplit.allow_currency_change', 'on', true);
  update tripsplit.trips
  set currency = p_currency,
      budget = round(budget * v_rate, v_decimals)
  where id = p_trip_id;
  perform set_config('tripsplit.allow_currency_change', 'off', true);

  -- The expenses trigger recomputes converted_amount in the new trip currency.
  update tripsplit.expenses e
  set exchange_rate = case when e.currency = p_currency then 1 else round(e.exchange_rate * v_rate, 8) end
  where e.trip_id = p_trip_id;

  for v_expense_id in select e.id from tripsplit.expenses e where e.trip_id = p_trip_id loop
    perform tripsplit_private.reallocate_expense_splits(v_expense_id);
  end loop;

  update tripsplit.settlements
  set amount = round(amount * v_rate, v_decimals)
  where trip_id = p_trip_id;

  update tripsplit.budget_categories
  set planned_amount = round(planned_amount * v_rate, v_decimals)
  where trip_id = p_trip_id;
end;
$$;

revoke all on function
  tripsplit_private.reallocate_expense_splits(uuid),
  tripsplit.change_trip_currency(uuid, text, numeric)
from public;
grant execute on function tripsplit.change_trip_currency(uuid, text, numeric) to authenticated, service_role;
grant execute on function tripsplit_private.reallocate_expense_splits(uuid) to service_role;
