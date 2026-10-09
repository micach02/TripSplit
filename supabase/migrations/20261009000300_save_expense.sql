-- =============================================================================
-- TripSplit · save_expense RPC
--
-- Creates or updates an expense together with its splits in one transaction.
-- SECURITY INVOKER: every write goes through the caller's RLS policies, so a
-- member can only create expenses in their trips and only edit expenses they
-- created, paid for, or own the trip of.
--
-- p_expense: { id?, trip_id, category_id, description, amount, currency,
--              exchange_rate, paid_by, expense_date, notes }
-- p_splits:  [{ user_id, split_type, value, amount }, …]   (amount in trip currency)
--
-- The client computes split amounts (largest-remainder allocation); the
-- database re-checks the inputs and that the amounts add up exactly.
-- =============================================================================

create function tripsplit.save_expense(p_expense jsonb, p_splits jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_expense ->> 'id', '')::uuid;
  v_trip_id uuid := (p_expense ->> 'trip_id')::uuid;
  v_amount numeric := (p_expense ->> 'amount')::numeric;
  v_type_count integer;
  v_type_text text;
  v_split_type tripsplit.split_type;
  v_value_total numeric;
  v_value_min numeric;
begin
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
      trip_id, category_id, description, amount, currency, exchange_rate, paid_by, expense_date, notes
    )
    values (
      v_trip_id,
      (p_expense ->> 'category_id')::uuid,
      btrim(p_expense ->> 'description'),
      v_amount,
      p_expense ->> 'currency',
      coalesce(nullif(p_expense ->> 'exchange_rate', '')::numeric, 1),
      (p_expense ->> 'paid_by')::uuid,
      coalesce(nullif(p_expense ->> 'expense_date', '')::date, current_date),
      nullif(btrim(p_expense ->> 'notes'), '')
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
        notes = nullif(btrim(p_expense ->> 'notes'), '')
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

revoke all on function tripsplit.save_expense(jsonb, jsonb) from public;
grant execute on function tripsplit.save_expense(jsonb, jsonb) to authenticated, service_role;
