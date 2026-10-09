-- =============================================================================
-- TripSplit · Receipts
--
-- Private bucket: tripsplit-receipts/<trip id>/<expense id>/<file>.
--   * trip members can view receipts (through signed URLs)
--   * only people who may edit the expense (creator, payer, trip owner) can
--     upload, replace or delete its receipt
--   * expenses.receipt_url must point inside that expense's own folder, so a
--     receipt can't be "borrowed" from another expense or trip
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tripsplit-receipts', 'tripsplit-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- The n-th folder of an object path as a uuid, or null when it isn't one.
create function tripsplit_private.path_uuid(p_name text, p_position integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', p_position)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- True when the caller may attach a file at this path: the path names an
-- expense of that trip, and the caller may edit the expense.
create function tripsplit_private.can_manage_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from tripsplit.expenses e
    where e.id = tripsplit_private.path_uuid(p_name, 2)
      and e.trip_id = tripsplit_private.path_uuid(p_name, 1)
      and tripsplit_private.can_modify_expense(e.id)
  );
$$;

revoke all on function tripsplit_private.path_uuid(text, integer), tripsplit_private.can_manage_receipt(text) from public;
grant execute on function tripsplit_private.path_uuid(text, integer), tripsplit_private.can_manage_receipt(text)
  to authenticated, service_role;

create policy "TripSplit receipts: members can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tripsplit-receipts'
    and tripsplit_private.is_trip_member(tripsplit_private.path_uuid(name, 1))
  );

create policy "TripSplit receipts: expense editors can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tripsplit-receipts' and tripsplit_private.can_manage_receipt(name));

create policy "TripSplit receipts: expense editors can replace"
  on storage.objects for update to authenticated
  using (bucket_id = 'tripsplit-receipts' and tripsplit_private.can_manage_receipt(name))
  with check (bucket_id = 'tripsplit-receipts' and tripsplit_private.can_manage_receipt(name));

create policy "TripSplit receipts: expense editors can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tripsplit-receipts' and tripsplit_private.can_manage_receipt(name));

-- -----------------------------------------------------------------------------
-- expenses.receipt_url must live in the expense's own folder
-- (same body as before, plus the receipt check)
-- -----------------------------------------------------------------------------
create or replace function tripsplit_private.expenses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_currency text;
begin
  select t.currency into v_trip_currency from tripsplit.trips t where t.id = new.trip_id;
  if v_trip_currency is null then
    raise exception using errcode = 'P0001', message = 'trip_not_found';
  end if;

  perform tripsplit_private.assert_currency_precision(new.amount, new.currency);

  if new.currency = v_trip_currency then
    new.exchange_rate := 1;
  end if;

  new.converted_amount := round(new.amount * new.exchange_rate, tripsplit_private.currency_decimals(v_trip_currency));

  if tg_op = 'INSERT' or new.paid_by is distinct from old.paid_by then
    if not exists (
      select 1 from tripsplit.trip_members m
      where m.trip_id = new.trip_id and m.user_id = new.paid_by
    ) then
      raise exception using errcode = 'P0001', message = 'payer_not_member';
    end if;
  end if;

  if new.receipt_url is not null
     and left(new.receipt_url, 74) <> new.trip_id::text || '/' || new.id::text || '/' then
    raise exception using errcode = 'P0001', message = 'invalid_receipt_path';
  end if;

  return new;
end;
$$;
