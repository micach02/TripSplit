-- =============================================================================
-- TripSplit · Members & invitations
--
-- * A member who has paid for, shared in, or settled anything on a trip can't
--   be removed (or leave): their name must stay visible in the trip history.
-- * Invitees can't read the trip or the inviter's profile until they join, so
--   they see and answer invitations through SECURITY DEFINER RPCs that check
--   the invitation belongs to the caller's email.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Guard: keep members with financial activity on the trip
-- -----------------------------------------------------------------------------
create function tripsplit_private.trip_members_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deleting the whole trip cascades here after the trip row is gone: allow it.
  if not exists (select 1 from tripsplit.trips t where t.id = old.trip_id) then
    return old;
  end if;

  if exists (select 1 from tripsplit.expenses e where e.trip_id = old.trip_id and e.paid_by = old.user_id)
     or exists (
       select 1
       from tripsplit.expense_splits s
       join tripsplit.expenses e on e.id = s.expense_id
       where e.trip_id = old.trip_id and s.user_id = old.user_id
     )
     or exists (
       select 1 from tripsplit.settlements s
       where s.trip_id = old.trip_id and old.user_id in (s.from_user_id, s.to_user_id)
     )
  then
    raise exception using errcode = 'P0001', message = 'member_has_activity';
  end if;

  return old;
end;
$$;

create trigger trip_members_before_delete
  before delete on tripsplit.trip_members
  for each row execute function tripsplit_private.trip_members_before_delete();

-- -----------------------------------------------------------------------------
-- The caller's email, straight from auth (the JWT copy can be stale)
-- -----------------------------------------------------------------------------
create function tripsplit_private.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Pending invitations for the signed-in user, with what they need to decide
-- -----------------------------------------------------------------------------
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
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.trip_id, t.name, t.destination, t.start_date, t.end_date,
         p.full_name, p.avatar_url, i.expires_at, i.created_at
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

-- Locks and validates one of the caller's invitations.
create function tripsplit_private.claim_invitation(p_invitation_id uuid)
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

  if not found or v_invitation.invited_email <> tripsplit_private.current_user_email() then
    raise exception using errcode = 'P0001', message = 'invitation_not_found';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'invitation_not_pending';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'invitation_expired';
  end if;

  return v_invitation;
end;
$$;

-- Joins the trip; returns its id.
create function tripsplit.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation tripsplit.trip_invitations := tripsplit_private.claim_invitation(p_invitation_id);
begin
  perform tripsplit.ensure_profile();

  insert into tripsplit.trip_members (trip_id, user_id, role)
  values (v_invitation.trip_id, (select auth.uid()), 'member')
  on conflict (trip_id, user_id) do nothing;

  update tripsplit.trip_invitations set status = 'accepted' where id = v_invitation.id;
  return v_invitation.trip_id;
end;
$$;

create function tripsplit.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation tripsplit.trip_invitations := tripsplit_private.claim_invitation(p_invitation_id);
begin
  update tripsplit.trip_invitations set status = 'declined' where id = v_invitation.id;
end;
$$;

revoke all on function
  tripsplit_private.trip_members_before_delete(),
  tripsplit_private.current_user_email(),
  tripsplit_private.claim_invitation(uuid),
  tripsplit.get_my_invitations(),
  tripsplit.accept_invitation(uuid),
  tripsplit.decline_invitation(uuid)
from public;

grant execute on function
  tripsplit.get_my_invitations(),
  tripsplit.accept_invitation(uuid),
  tripsplit.decline_invitation(uuid)
to authenticated;

grant execute on function
  tripsplit_private.trip_members_before_delete(),
  tripsplit_private.current_user_email(),
  tripsplit_private.claim_invitation(uuid),
  tripsplit.get_my_invitations(),
  tripsplit.accept_invitation(uuid),
  tripsplit.decline_invitation(uuid)
to service_role;
