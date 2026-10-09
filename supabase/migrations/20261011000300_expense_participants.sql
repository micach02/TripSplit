-- =============================================================================
-- TripSplit · Expense participants (for the "Involving" filter)
--
-- expenses.participant_ids = the payer + everyone with a share, kept up to
-- date by triggers, so "expenses involving Ben" is one indexed array lookup.
-- Clients can't write it (no UPDATE grant; inserts are recomputed).
-- =============================================================================

alter table tripsplit.expenses add column participant_ids uuid[] not null default '{}';

create index expenses_participant_ids_idx on tripsplit.expenses using gin (participant_ids);

create function tripsplit_private.refresh_expense_participants(p_expense_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update tripsplit.expenses e
  set participant_ids = coalesce((
    select array_agg(distinct person order by person)
    from (
      select e.paid_by as person
      union
      select s.user_id from tripsplit.expense_splits s where s.expense_id = e.id
    ) people
  ), '{}')
  where e.id = p_expense_id;
$$;

create function tripsplit_private.expenses_after_participants_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tripsplit_private.refresh_expense_participants(new.id);
  return null;
end;
$$;

-- Only when the payer changes (or on insert) — the refresh itself updates just
-- participant_ids, so this can't recurse.
create trigger expenses_participants_refresh
  after insert or update of paid_by on tripsplit.expenses
  for each row execute function tripsplit_private.expenses_after_participants_change();

create function tripsplit_private.expense_splits_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tripsplit_private.refresh_expense_participants(case when tg_op = 'DELETE' then old.expense_id else new.expense_id end);
  return null;
end;
$$;

create trigger expense_splits_participants_refresh
  after insert or update of user_id or delete on tripsplit.expense_splits
  for each row execute function tripsplit_private.expense_splits_after_change();

revoke all on function
  tripsplit_private.refresh_expense_participants(uuid),
  tripsplit_private.expenses_after_participants_change(),
  tripsplit_private.expense_splits_after_change()
from public;

-- Backfill existing expenses
update tripsplit.expenses e
set participant_ids = coalesce((
  select array_agg(distinct person order by person)
  from (
    select e.paid_by as person
    union
    select s.user_id from tripsplit.expense_splits s where s.expense_id = e.id
  ) people
), '{}');
