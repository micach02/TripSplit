-- =============================================================================
-- TripSplit · Onboarding backfill
--
-- Accounts created before the welcome steps existed, and already on a budget or
-- trip, don't need them: count them as onboarded (as of when they signed up).
-- Accounts with nothing yet still see the welcome steps once.
-- =============================================================================

update tripsplit.profiles p
set onboarded_at = p.created_at
where p.onboarded_at is null
  and p.guest_trip_id is null
  and exists (select 1 from tripsplit.trip_members m where m.user_id = p.id);
