-- =============================================================================
-- TripSplit · Invitee name
--
-- Owners invite with a name as well as an email, so pending invitations read
-- "John (john@…)" instead of a bare address.
-- =============================================================================

alter table tripsplit.trip_invitations
  add column invited_name text check (char_length(btrim(invited_name)) between 1 and 100);

comment on column tripsplit.trip_invitations.invited_name is 'How the owner refers to the invitee until they join.';
