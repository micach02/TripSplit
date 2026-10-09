-- =============================================================================
-- TripSplit · Grants & Row Level Security
--
-- Access model
--   * Only signed-in users can reach TripSplit; `anon` has no privileges.
--   * A trip — and everything inside it — is visible only to its members
--     (the owner is always a member, added by trigger on trip creation).
--   * Owners edit/delete the trip, manage categories, category budgets,
--     invitations and members.
--   * Members add expenses and settlements, and edit/delete expenses they
--     created or paid for (owners can edit/delete any expense in their trip).
--   * Membership is never written directly by clients: owners are added by
--     trigger and invitees join through a security-definer RPC (Phase 7).
--   * Column-level UPDATE grants keep identity columns (owner_id, trip_id,
--     created_by, email, …) immutable from the API.
--
-- Grants are explicit (rather than Supabase's public-schema defaults) so
-- nothing is exposed by accident when the schema is added to the Data API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Policy helpers. SECURITY DEFINER so they can read trip_members without
-- recursing through trip_members' own policies. Kept in tripsplit_private,
-- which is never exposed through the Data API.
-- -----------------------------------------------------------------------------
create function tripsplit_private.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from tripsplit.trip_members m
    where m.trip_id = p_trip_id and m.user_id = (select auth.uid())
  );
$$;

create function tripsplit_private.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from tripsplit.trips t
    where t.id = p_trip_id and t.owner_id = (select auth.uid())
  );
$$;

create function tripsplit_private.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from tripsplit.trip_members mine
    join tripsplit.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

create function tripsplit_private.can_view_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from tripsplit.expenses e
    join tripsplit.trip_members m on m.trip_id = e.trip_id and m.user_id = (select auth.uid())
    where e.id = p_expense_id
  );
$$;

create function tripsplit_private.can_modify_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from tripsplit.expenses e
    join tripsplit.trip_members m on m.trip_id = e.trip_id and m.user_id = (select auth.uid())
    join tripsplit.trips t on t.id = e.trip_id
    where e.id = p_expense_id
      and (
        e.created_by = (select auth.uid())
        or e.paid_by = (select auth.uid())
        or t.owner_id = (select auth.uid())
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Schema & function privileges
-- -----------------------------------------------------------------------------
revoke all on schema tripsplit, tripsplit_private from public;
grant usage on schema tripsplit, tripsplit_private to authenticated, service_role;

-- Functions are executable by PUBLIC by default — lock both schemas down.
revoke all on all functions in schema tripsplit, tripsplit_private from public;
grant execute on function
  tripsplit_private.is_trip_member(uuid),
  tripsplit_private.is_trip_owner(uuid),
  tripsplit_private.shares_trip_with(uuid),
  tripsplit_private.can_view_expense(uuid),
  tripsplit_private.can_modify_expense(uuid),
  tripsplit.ensure_profile()
to authenticated;
grant execute on all functions in schema tripsplit, tripsplit_private to service_role;

-- -----------------------------------------------------------------------------
-- Table privileges. service_role (server-side only) keeps full access and
-- bypasses RLS; authenticated users get exactly what the app needs.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema tripsplit from public, anon, authenticated;
grant all on all tables in schema tripsplit to service_role;

grant select on tripsplit.currencies, tripsplit.trip_totals to authenticated;

grant select on tripsplit.profiles to authenticated;
grant update (full_name, avatar_url, preferred_currency) on tripsplit.profiles to authenticated;

grant select, insert, delete on tripsplit.trips to authenticated;
grant update (name, destination, description, start_date, end_date, budget, currency, cover_image_url, status)
  on tripsplit.trips to authenticated;

grant select, delete on tripsplit.trip_members to authenticated;

grant select, insert, delete on tripsplit.trip_invitations to authenticated;
grant update (status, expires_at) on tripsplit.trip_invitations to authenticated;

grant select, insert, delete on tripsplit.categories to authenticated;
grant update (name, icon, color, sort_order) on tripsplit.categories to authenticated;

grant select, insert, delete on tripsplit.expenses to authenticated;
grant update (category_id, description, amount, currency, exchange_rate, paid_by, expense_date, notes, receipt_url)
  on tripsplit.expenses to authenticated;

grant select, insert, delete on tripsplit.expense_splits to authenticated;
grant update (split_type, value, amount) on tripsplit.expense_splits to authenticated;

grant select, insert, delete on tripsplit.settlements to authenticated;
grant update (from_user_id, to_user_id, amount, payment_method, settlement_date, note)
  on tripsplit.settlements to authenticated;

grant select, insert, delete on tripsplit.budget_categories to authenticated;
grant update (planned_amount) on tripsplit.budget_categories to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security on every table
-- -----------------------------------------------------------------------------
alter table tripsplit.currencies enable row level security;
alter table tripsplit.profiles enable row level security;
alter table tripsplit.trips enable row level security;
alter table tripsplit.trip_members enable row level security;
alter table tripsplit.trip_invitations enable row level security;
alter table tripsplit.categories enable row level security;
alter table tripsplit.expenses enable row level security;
alter table tripsplit.expense_splits enable row level security;
alter table tripsplit.settlements enable row level security;
alter table tripsplit.budget_categories enable row level security;

-- currencies — read-only reference data
create policy "Signed-in users can read currencies"
  on tripsplit.currencies for select to authenticated
  using (true);

-- profiles (rows are created by tripsplit.ensure_profile())
create policy "Users can read their own profile and fellow travelers'"
  on tripsplit.profiles for select to authenticated
  using (id = (select auth.uid()) or tripsplit_private.shares_trip_with(id));

create policy "Users can update their own profile"
  on tripsplit.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- trips
create policy "Members can view their trips"
  on tripsplit.trips for select to authenticated
  using (owner_id = (select auth.uid()) or tripsplit_private.is_trip_member(id));

create policy "Users can create trips they own"
  on tripsplit.trips for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can update their trips"
  on tripsplit.trips for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete their trips"
  on tripsplit.trips for delete to authenticated
  using (owner_id = (select auth.uid()));

-- trip_members
create policy "Members can view their trip's roster"
  on tripsplit.trip_members for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Owners can remove members; members can leave"
  on tripsplit.trip_members for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = (select auth.uid()) or tripsplit_private.is_trip_owner(trip_id))
  );

-- trip_invitations
create policy "Members and the invitee can view invitations"
  on tripsplit.trip_invitations for select to authenticated
  using (
    tripsplit_private.is_trip_member(trip_id)
    or invited_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

create policy "Owners can invite"
  on tripsplit.trip_invitations for insert to authenticated
  with check (tripsplit_private.is_trip_owner(trip_id) and invited_by = (select auth.uid()));

create policy "Owners can update invitations"
  on tripsplit.trip_invitations for update to authenticated
  using (tripsplit_private.is_trip_owner(trip_id))
  with check (tripsplit_private.is_trip_owner(trip_id));

create policy "Owners can delete invitations"
  on tripsplit.trip_invitations for delete to authenticated
  using (tripsplit_private.is_trip_owner(trip_id));

-- categories
create policy "Members can view categories"
  on tripsplit.categories for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Owners can add categories"
  on tripsplit.categories for insert to authenticated
  with check (tripsplit_private.is_trip_owner(trip_id));

create policy "Owners can update categories"
  on tripsplit.categories for update to authenticated
  using (tripsplit_private.is_trip_owner(trip_id))
  with check (tripsplit_private.is_trip_owner(trip_id));

create policy "Owners can delete categories"
  on tripsplit.categories for delete to authenticated
  using (tripsplit_private.is_trip_owner(trip_id));

-- expenses
create policy "Members can view expenses"
  on tripsplit.expenses for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Members can add expenses"
  on tripsplit.expenses for insert to authenticated
  with check (tripsplit_private.is_trip_member(trip_id) and created_by = (select auth.uid()));

create policy "Creator, payer or owner can update an expense"
  on tripsplit.expenses for update to authenticated
  using (
    tripsplit_private.is_trip_member(trip_id)
    and (
      created_by = (select auth.uid())
      or paid_by = (select auth.uid())
      or tripsplit_private.is_trip_owner(trip_id)
    )
  )
  with check (tripsplit_private.is_trip_member(trip_id));

create policy "Creator, payer or owner can delete an expense"
  on tripsplit.expenses for delete to authenticated
  using (
    tripsplit_private.is_trip_member(trip_id)
    and (
      created_by = (select auth.uid())
      or paid_by = (select auth.uid())
      or tripsplit_private.is_trip_owner(trip_id)
    )
  );

-- expense_splits
create policy "Members can view splits"
  on tripsplit.expense_splits for select to authenticated
  using (tripsplit_private.can_view_expense(expense_id));

create policy "Expense editors can add splits"
  on tripsplit.expense_splits for insert to authenticated
  with check (tripsplit_private.can_modify_expense(expense_id));

create policy "Expense editors can update splits"
  on tripsplit.expense_splits for update to authenticated
  using (tripsplit_private.can_modify_expense(expense_id))
  with check (tripsplit_private.can_modify_expense(expense_id));

create policy "Expense editors can delete splits"
  on tripsplit.expense_splits for delete to authenticated
  using (tripsplit_private.can_modify_expense(expense_id));

-- settlements
create policy "Members can view settlements"
  on tripsplit.settlements for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Members can record settlements"
  on tripsplit.settlements for insert to authenticated
  with check (tripsplit_private.is_trip_member(trip_id) and created_by = (select auth.uid()));

create policy "Recorder or owner can update a settlement"
  on tripsplit.settlements for update to authenticated
  using (
    tripsplit_private.is_trip_member(trip_id)
    and (created_by = (select auth.uid()) or tripsplit_private.is_trip_owner(trip_id))
  )
  with check (tripsplit_private.is_trip_member(trip_id));

create policy "Recorder or owner can delete a settlement"
  on tripsplit.settlements for delete to authenticated
  using (
    tripsplit_private.is_trip_member(trip_id)
    and (created_by = (select auth.uid()) or tripsplit_private.is_trip_owner(trip_id))
  );

-- budget_categories
create policy "Members can view category budgets"
  on tripsplit.budget_categories for select to authenticated
  using (tripsplit_private.is_trip_member(trip_id));

create policy "Owners can add category budgets"
  on tripsplit.budget_categories for insert to authenticated
  with check (tripsplit_private.is_trip_owner(trip_id));

create policy "Owners can update category budgets"
  on tripsplit.budget_categories for update to authenticated
  using (tripsplit_private.is_trip_owner(trip_id))
  with check (tripsplit_private.is_trip_owner(trip_id));

create policy "Owners can delete category budgets"
  on tripsplit.budget_categories for delete to authenticated
  using (tripsplit_private.is_trip_owner(trip_id));
