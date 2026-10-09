-- =============================================================================
-- TripSplit · Member balances
--
-- Net balance = paid − share + settlements paid − settlements received.
-- Positive: the member should receive money. Negative: they owe money.
-- Across a trip the nets always sum to zero.
--
-- security_invoker: callers only see balances for trips their RLS allows.
-- (The trip page computes the same numbers in the app from the ledger; this
-- view lets the dashboard show "your balance" for every trip in one query.)
-- =============================================================================

create view tripsplit.trip_member_balances
with (security_invoker = true)
as
select
  m.trip_id,
  m.user_id,
  coalesce(paid.total, 0)::numeric(14, 2) as paid,
  coalesce(share.total, 0)::numeric(14, 2) as share,
  coalesce(sent.total, 0)::numeric(14, 2) as settlements_paid,
  coalesce(received.total, 0)::numeric(14, 2) as settlements_received,
  (coalesce(paid.total, 0) - coalesce(share.total, 0) + coalesce(sent.total, 0) - coalesce(received.total, 0))::numeric(14, 2) as net
from tripsplit.trip_members m
left join lateral (
  select sum(e.converted_amount) as total
  from tripsplit.expenses e
  where e.trip_id = m.trip_id and e.paid_by = m.user_id
) paid on true
left join lateral (
  select sum(s.amount) as total
  from tripsplit.expense_splits s
  join tripsplit.expenses e on e.id = s.expense_id
  where e.trip_id = m.trip_id and s.user_id = m.user_id
) share on true
left join lateral (
  select sum(st.amount) as total
  from tripsplit.settlements st
  where st.trip_id = m.trip_id and st.from_user_id = m.user_id
) sent on true
left join lateral (
  select sum(st.amount) as total
  from tripsplit.settlements st
  where st.trip_id = m.trip_id and st.to_user_id = m.user_id
) received on true;

revoke all on tripsplit.trip_member_balances from public, anon, authenticated;
grant select on tripsplit.trip_member_balances to authenticated;
grant all on tripsplit.trip_member_balances to service_role;
