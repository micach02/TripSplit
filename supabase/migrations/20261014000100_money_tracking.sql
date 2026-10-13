-- =============================================================================
-- TripSplit · Money tracking
--
-- * Expenses record how they were paid (cash, GCash, Maya, card…).
-- * Budgets can roll unspent money (or overspending) into the next month.
-- * Profiles remember a default budget/trip for the quick-add button.
-- * Incomes: personal (never shared) income entries, for "income vs spending".
-- * my_expense_shares: the signed-in user's share of every expense they're in,
--   across all budgets and trips — the basis of "My spending".
-- * trip_category_month_totals: spending per category per month (alerts).
-- (save_expense learns payment methods and offline ids in the next migration,
--  together with recurring expenses.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Payment method on expenses (reuses the settlements enum, with two additions)
-- -----------------------------------------------------------------------------
alter type tripsplit.payment_method add value if not exists 'maya';
alter type tripsplit.payment_method add value if not exists 'card';

alter table tripsplit.expenses add column payment_method tripsplit.payment_method;
grant update (payment_method) on tripsplit.expenses to authenticated;

-- -----------------------------------------------------------------------------
-- Rollover for monthly budgets
-- -----------------------------------------------------------------------------
alter table tripsplit.trips add column rollover boolean not null default false;
comment on column tripsplit.trips.rollover is
  'Budgets: carry each month''s unspent amount (or overspend) into the next month.';
grant update (rollover) on tripsplit.trips to authenticated;

-- -----------------------------------------------------------------------------
-- Default budget/trip for quick add
-- -----------------------------------------------------------------------------
alter table tripsplit.profiles
  add column default_trip_id uuid references tripsplit.trips (id) on delete set null;
create index profiles_default_trip_id_idx on tripsplit.profiles (default_trip_id);
grant update (default_trip_id) on tripsplit.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Personal income
-- -----------------------------------------------------------------------------
create table tripsplit.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references tripsplit.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null references tripsplit.currencies (code),
  received_on date not null default current_date,
  source text not null check (char_length(btrim(source)) between 1 and 80),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index incomes_user_date_idx on tripsplit.incomes (user_id, received_on desc);

create function tripsplit_private.incomes_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tripsplit_private.assert_currency_precision(new.amount, new.currency);
  new.source := btrim(new.source);
  return new;
end;
$$;

create trigger incomes_before_write
  before insert or update on tripsplit.incomes
  for each row execute function tripsplit_private.incomes_before_write();

alter table tripsplit.incomes enable row level security;

create policy "Income is private to its owner"
  on tripsplit.incomes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, delete on tripsplit.incomes to authenticated;
grant update (amount, currency, received_on, source, notes) on tripsplit.incomes to authenticated;
grant all on tripsplit.incomes to service_role;

-- -----------------------------------------------------------------------------
-- My share of every expense I'm in (RLS applies through security_invoker)
-- -----------------------------------------------------------------------------
create view tripsplit.my_expense_shares
with (security_invoker = true)
as
select
  e.id as expense_id,
  e.trip_id,
  t.name as trip_name,
  t.kind as trip_kind,
  t.currency as trip_currency,
  e.category_id,
  c.name as category_name,
  c.icon as category_icon,
  c.color as category_color,
  e.description,
  e.expense_date,
  e.payment_method,
  e.paid_by,
  e.converted_amount as total,
  s.amount as my_share
from tripsplit.expense_splits s
join tripsplit.expenses e on e.id = s.expense_id
join tripsplit.trips t on t.id = e.trip_id
join tripsplit.categories c on c.id = e.category_id
where s.user_id = (select auth.uid());

grant select on tripsplit.my_expense_shares to authenticated;
grant all on tripsplit.my_expense_shares to service_role;

-- Spending per category per month (budget alerts)
create view tripsplit.trip_category_month_totals
with (security_invoker = true)
as
select
  e.trip_id,
  e.category_id,
  date_trunc('month', e.expense_date)::date as month,
  sum(e.converted_amount)::numeric(14, 2) as total_spent
from tripsplit.expenses e
group by e.trip_id, e.category_id, date_trunc('month', e.expense_date);

grant select on tripsplit.trip_category_month_totals to authenticated;
grant all on tripsplit.trip_category_month_totals to service_role;

revoke all on function tripsplit_private.incomes_before_write() from public;
grant execute on function tripsplit_private.incomes_before_write() to service_role;
