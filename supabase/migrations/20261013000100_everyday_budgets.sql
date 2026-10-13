-- =============================================================================
-- TripSplit · Everyday budgets
--
-- A trip row can now be a monthly budget for everyday spending (groceries,
-- food, bills…): kind = 'budget'. Budgets reuse members, invitations,
-- expenses, splits, receipts, settlements and category budgets. What differs:
--
--   * `budget` is the amount per calendar month, and budget_categories hold
--     monthly limits per category. Each month starts fresh.
--   * No end date (budgets are ongoing) and no destination.
--   * Everyday default categories instead of travel ones.
--   * trip_month_totals gives spending per calendar month.
--
-- `kind` is chosen at creation and can't change afterwards: it isn't in the
-- column-level UPDATE grant on trips.
-- =============================================================================

create type tripsplit.trip_kind as enum ('trip', 'budget');

alter table tripsplit.trips
  add column kind tripsplit.trip_kind not null default 'trip',
  alter column end_date drop not null,
  add constraint trips_end_date_required check (kind = 'budget' or end_date is not null);

comment on column tripsplit.trips.kind is 'trip: dated, one total budget. budget: ongoing, budget is per calendar month.';
comment on column tripsplit.trips.budget is 'Trips: total budget. Budgets: amount per calendar month.';

-- -----------------------------------------------------------------------------
-- New trip or budget → owner membership + default categories for its kind
-- -----------------------------------------------------------------------------
create or replace function tripsplit_private.handle_new_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into tripsplit.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  if new.kind = 'budget' then
    insert into tripsplit.categories (trip_id, name, icon, color, is_default, sort_order)
    select new.id, d.name, d.icon, d.color, true, d.sort_order
    from (values
      ('Groceries',         '🛒', '#22c55e', 1),
      ('Dining out',        '🍽️', '#f97316', 2),
      ('Food delivery',     '🛵', '#eab308', 3),
      ('Transport',         '🚌', '#0ea5e9', 4),
      ('Bills & utilities', '💡', '#6366f1', 5),
      ('Rent',              '🏠', '#8b5cf6', 6),
      ('Household',         '🧺', '#14b8a6', 7),
      ('Health',            '💊', '#06b6d4', 8),
      ('Personal care',     '🧴', '#ec4899', 9),
      ('Shopping',          '🛍️', '#d946ef', 10),
      ('Entertainment',     '🎬', '#f43f5e', 11),
      ('Subscriptions',     '📺', '#3b82f6', 12),
      ('Other',             '📦', '#64748b', 99)
    ) as d(name, icon, color, sort_order);
  else
    insert into tripsplit.categories (trip_id, name, icon, color, is_default, sort_order)
    select new.id, d.name, d.icon, d.color, true, d.sort_order
    from (values
      ('Food',           '🍜', '#f97316', 1),
      ('Transportation', '🚕', '#0ea5e9', 2),
      ('Accommodation',  '🏨', '#8b5cf6', 3),
      ('Flights',        '✈️', '#3b82f6', 4),
      ('Activities',     '🎢', '#ec4899', 5),
      ('Shopping',       '🛍️', '#d946ef', 6),
      ('Entertainment',  '🎭', '#f43f5e', 7),
      ('Tickets',        '🎟️', '#14b8a6', 8),
      ('Drinks',         '🍹', '#eab308', 9),
      ('Groceries',      '🛒', '#22c55e', 10),
      ('Visa',           '🛂', '#6366f1', 11),
      ('Insurance',      '🛡️', '#0d9488', 12),
      ('Other',          '📦', '#64748b', 99)
    ) as d(name, icon, color, sort_order);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Spending per calendar month (security_invoker: RLS applies to callers)
-- -----------------------------------------------------------------------------
create view tripsplit.trip_month_totals
with (security_invoker = true)
as
select
  e.trip_id,
  date_trunc('month', e.expense_date)::date as month,
  sum(e.converted_amount)::numeric(14, 2) as total_spent,
  count(*)::integer as expense_count
from tripsplit.expenses e
group by e.trip_id, date_trunc('month', e.expense_date);

grant select on tripsplit.trip_month_totals to authenticated;
grant all on tripsplit.trip_month_totals to service_role;

-- -----------------------------------------------------------------------------
-- Invitations say whether they're for a trip or a budget
-- (return types change, so these are dropped and re-created)
-- -----------------------------------------------------------------------------
drop function tripsplit.get_my_invitations();

create function tripsplit.get_my_invitations()
returns table (
  id uuid,
  trip_id uuid,
  trip_name text,
  destination text,
  start_date date,
  end_date date,
  invited_by_name text,
  invited_by_avatar_url text,
  expires_at timestamptz,
  created_at timestamptz,
  trip_kind tripsplit.trip_kind
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.trip_id, t.name, t.destination, t.start_date, t.end_date,
         p.full_name, p.avatar_url, i.expires_at, i.created_at, t.kind
  from tripsplit.trip_invitations i
  join tripsplit.trips t on t.id = i.trip_id
  join tripsplit.profiles p on p.id = i.invited_by
  where i.invited_email = tripsplit_private.current_user_email()
    and i.status = 'pending'
    and i.expires_at > now()
    and not exists (
      select 1 from tripsplit.trip_members m
      where m.trip_id = i.trip_id and m.user_id = (select auth.uid())
    )
  order by i.created_at desc;
$$;

drop function tripsplit.get_invitation_preview(uuid);

create function tripsplit.get_invitation_preview(p_token uuid)
returns table (
  trip_id uuid,
  trip_name text,
  destination text,
  start_date date,
  end_date date,
  invited_by_name text,
  invited_by_avatar_url text,
  invited_name text,
  status text,
  already_member boolean,
  trip_kind tripsplit.trip_kind
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.trip_id,
    t.name,
    t.destination,
    t.start_date,
    t.end_date,
    p.full_name,
    p.avatar_url,
    i.invited_name,
    case
      when i.status = 'pending' and i.expires_at <= now() then 'expired'
      else i.status::text
    end,
    exists (
      select 1 from tripsplit.trip_members m
      where m.trip_id = i.trip_id and m.user_id = (select auth.uid())
    ),
    t.kind
  from tripsplit.trip_invitations i
  join tripsplit.trips t on t.id = i.trip_id
  join tripsplit.profiles p on p.id = i.invited_by
  where i.token = p_token
    and (select auth.uid()) is not null;
$$;

revoke all on function
  tripsplit.get_my_invitations(),
  tripsplit.get_invitation_preview(uuid)
from public;

grant execute on function
  tripsplit.get_my_invitations(),
  tripsplit.get_invitation_preview(uuid)
to authenticated, service_role;
