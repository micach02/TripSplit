-- =============================================================================
-- TripSplit · Onboarding
--
-- profiles.onboarded_at: when the person finished (or skipped) the welcome
-- steps. New accounts start with null and see the welcome screen once — on
-- whichever device they sign in from first, not once per device.
-- =============================================================================

alter table tripsplit.profiles add column onboarded_at timestamptz;

comment on column tripsplit.profiles.onboarded_at is
  'When the person finished or skipped the welcome steps; null shows them once.';

grant update (onboarded_at) on tripsplit.profiles to authenticated;
