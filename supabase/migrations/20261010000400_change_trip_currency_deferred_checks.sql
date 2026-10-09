-- =============================================================================
-- TripSplit · change_trip_currency: self-contained split-total checks
--
-- Re-basing the expenses changes their converted totals before the splits are
-- re-spread. If an earlier statement in the same transaction made the
-- split-total checks IMMEDIATE (save_expense does), they'd fire in between.
-- Defer them on entry and validate once at the end — same as save_expense.
-- =============================================================================

create or replace function tripsplit.change_trip_currency(p_trip_id uuid, p_currency text, p_rate numeric)
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
  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check deferred;

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

  -- Everything must add up again before we return.
  set constraints tripsplit.expenses_split_total_check, tripsplit.expense_splits_total_check immediate;
end;
$$;
