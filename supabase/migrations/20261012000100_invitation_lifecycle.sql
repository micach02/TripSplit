-- =============================================================================
-- TripSplit · Invitation lifecycle (Phase 7)
--
-- * Invitation status changes only through functions: accept / decline (the
--   invitee), renew (the owner), delete = cancel (the owner). Clients can no
--   longer UPDATE invitation rows, so an owner can't mark someone "accepted"
--   or stretch an expiry indefinitely.
-- * renew_invitation gives an expired, declined or pending invitation a fresh
--   7-day window and a NEW link; the old link stops working.
-- * Joining a trip by any route (email invite, link, owner) closes every other
--   pending invitation to that person for the trip.
-- * "Expired" stays derived from expires_at (no scheduler on a shared project);
--   stale rows are marked expired when they get in the way of a new invite.
-- =============================================================================

revoke update on tripsplit.trip_invitations from authenticated;
drop policy "Owners can update invitations" on tripsplit.trip_invitations;

-- -----------------------------------------------------------------------------
-- Renew: new expiry, new link
-- -----------------------------------------------------------------------------
create function tripsplit.renew_invitation(p_invitation_id uuid)
returns tripsplit.trip_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation tripsplit.trip_invitations;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select * into v_invitation
  from tripsplit.trip_invitations i
  where i.id = p_invitation_id
  for update;

  if not found or not tripsplit_private.is_trip_owner(v_invitation.trip_id) then
    raise exception using errcode = 'P0001', message = 'invitation_not_found';
  end if;
  if v_invitation.status = 'accepted' then
    raise exception using errcode = 'P0001', message = 'invitation_not_pending';
  end if;
  if exists (
    select 1
    from tripsplit.trip_members m
    join tripsplit.profiles p on p.id = m.user_id
    where m.trip_id = v_invitation.trip_id and lower(p.email) = v_invitation.invited_email
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;
  if exists (
    select 1 from tripsplit.trip_invitations i
    where i.trip_id = v_invitation.trip_id
      and i.invited_email = v_invitation.invited_email
      and i.id <> v_invitation.id
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'invitation_already_pending';
  end if;

  -- Lapsed duplicates must not block this one (one pending invite per person).
  update tripsplit.trip_invitations
  set status = 'expired'
  where trip_id = v_invitation.trip_id
    and invited_email = v_invitation.invited_email
    and id <> v_invitation.id
    and status = 'pending'
    and expires_at <= now();

  update tripsplit.trip_invitations
  set status = 'pending',
      expires_at = now() + interval '7 days',
      token = gen_random_uuid()
  where id = v_invitation.id
  returning * into v_invitation;

  return v_invitation;
end;
$$;

-- -----------------------------------------------------------------------------
-- Joining closes the person's other pending invitations to the trip
-- -----------------------------------------------------------------------------
create function tripsplit_private.trip_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update tripsplit.trip_invitations i
  set status = 'accepted'
  from auth.users u
  where u.id = new.user_id
    and i.trip_id = new.trip_id
    and i.status = 'pending'
    and i.invited_email = lower(u.email);
  return null;
end;
$$;

create trigger trip_members_after_insert
  after insert on tripsplit.trip_members
  for each row execute function tripsplit_private.trip_members_after_insert();

revoke all on function
  tripsplit.renew_invitation(uuid),
  tripsplit_private.trip_members_after_insert()
from public;

grant execute on function tripsplit.renew_invitation(uuid) to authenticated, service_role;
grant execute on function tripsplit_private.trip_members_after_insert() to service_role;
