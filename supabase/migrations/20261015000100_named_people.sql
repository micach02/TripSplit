-- =============================================================================
-- TripSplit · People added by name
--
-- Friends on a trip don't need an account. A person added by name is a
-- profile that belongs to one trip (profiles.guest_trip_id), with no login,
-- email or avatar. Because they are a real profile and trip member, paying,
-- splits, balances, settlements and recurring expenses work for them exactly
-- as for everyone else, and the existing "must be a member" checks still apply.
--
-- * Any member can add people. The owner, or whoever added someone, can rename
--   or remove them; not once they have expenses, settlements or a recurring
--   expense, so the trip's history stays intact.
-- * Inviting them is optional. An invitation can point at a named person
--   (trip_invitations.person_id); whoever accepts it takes that person's place,
--   and everything recorded for them moves to the new account.
-- * profiles.id no longer references auth.users, so named people can exist.
--   Accounts still get their profile only through ensure_profile(). If an auth
--   user is deleted, their profile now stays behind (keeping trip history)
--   instead of being cascaded away.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Named people are profiles that belong to one trip
-- -----------------------------------------------------------------------------
alter table tripsplit.profiles drop constraint profiles_id_fkey;

alter table tripsplit.profiles
  add column guest_trip_id uuid references tripsplit.trips (id) on delete cascade,
  add column added_by uuid references tripsplit.profiles (id) on delete set null,
  alter column email drop not null,
  add constraint profiles_named_person_has_no_email check ((guest_trip_id is null) = (email is not null));

comment on column tripsplit.profiles.guest_trip_id is
  'Set for a person added by name (no account): the one trip they belong to.';
comment on column tripsplit.profiles.added_by is 'Who added this person by name.';

-- One "Ben" per trip; deleting the trip deletes its named people.
create unique index profiles_named_person_name_key
  on tripsplit.profiles (guest_trip_id, lower(btrim(full_name)))
  where guest_trip_id is not null;
create index profiles_added_by_idx on tripsplit.profiles (added_by);

create function tripsplit_private.assert_person_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception using errcode = 'P0001', message = 'person_name_invalid';
  end if;
  return v_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Add, rename, remove
-- -----------------------------------------------------------------------------
-- Adds someone to the trip by name; returns their id (use it like any user id).
create function tripsplit.add_trip_person(p_trip_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := tripsplit_private.assert_person_name(p_name);
  v_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if not tripsplit_private.is_trip_member(p_trip_id) then
    raise exception using errcode = 'P0001', message = 'not_permitted';
  end if;
  if exists (
    select 1 from tripsplit.profiles p
    where p.guest_trip_id = p_trip_id and lower(btrim(p.full_name)) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'person_name_taken';
  end if;

  insert into tripsplit.profiles (id, full_name, email, guest_trip_id, added_by, preferred_currency)
  select v_id, v_name, null, t.id, (select auth.uid()), t.currency
  from tripsplit.trips t
  where t.id = p_trip_id;

  insert into tripsplit.trip_members (trip_id, user_id, role)
  values (p_trip_id, v_id, 'member');

  return v_id;
end;
$$;

-- A named person the caller may manage: the trip owner or whoever added them.
create function tripsplit_private.manageable_person(p_person_id uuid)
returns tripsplit.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_person tripsplit.profiles;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select * into v_person
  from tripsplit.profiles p
  where p.id = p_person_id and p.guest_trip_id is not null;

  if not found or not tripsplit_private.is_trip_member(v_person.guest_trip_id) then
    raise exception using errcode = 'P0001', message = 'person_not_found';
  end if;
  if v_person.added_by is distinct from (select auth.uid())
     and not tripsplit_private.is_trip_owner(v_person.guest_trip_id) then
    raise exception using errcode = 'P0001', message = 'not_permitted';
  end if;

  return v_person;
end;
$$;

create function tripsplit.rename_trip_person(p_person_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person tripsplit.profiles := tripsplit_private.manageable_person(p_person_id);
  v_name text := tripsplit_private.assert_person_name(p_name);
begin
  if exists (
    select 1 from tripsplit.profiles p
    where p.guest_trip_id = v_person.guest_trip_id
      and p.id <> v_person.id
      and lower(btrim(p.full_name)) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'person_name_taken';
  end if;

  update tripsplit.profiles set full_name = v_name where id = v_person.id;
  -- Keep a pending invitation's greeting in step.
  update tripsplit.trip_invitations set invited_name = v_name where person_id = v_person.id and status = 'pending';
end;
$$;

-- Removes someone added by name. Refused once they have expenses or settlements
-- (trip_members_before_delete) or are part of a recurring expense.
create function tripsplit.remove_trip_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person tripsplit.profiles := tripsplit_private.manageable_person(p_person_id);
begin
  if exists (
    select 1 from tripsplit.recurring_expenses r
    where r.trip_id = v_person.guest_trip_id
      and (r.paid_by = v_person.id or v_person.id = any (r.participant_ids))
  ) then
    raise exception using errcode = 'P0001', message = 'person_in_recurring';
  end if;

  delete from tripsplit.trip_invitations where person_id = v_person.id and status = 'pending';
  -- Their membership goes with the profile.
  delete from tripsplit.profiles where id = v_person.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Optional invitation for a named person
-- -----------------------------------------------------------------------------
alter table tripsplit.trip_invitations
  add column person_id uuid references tripsplit.profiles (id) on delete set null;

comment on column tripsplit.trip_invitations.person_id is
  'A person added by name whom this invitation is for: whoever accepts takes their place.';

create unique index trip_invitations_one_pending_per_person_idx
  on tripsplit.trip_invitations (person_id)
  where status = 'pending' and person_id is not null;

create function tripsplit_private.trip_invitations_check_person()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_id is not null and not exists (
    select 1 from tripsplit.profiles p
    where p.id = new.person_id and p.guest_trip_id = new.trip_id
  ) then
    raise exception using errcode = 'P0001', message = 'person_not_found';
  end if;
  return new;
end;
$$;

create trigger trip_invitations_check_person
  before insert or update of person_id on tripsplit.trip_invitations
  for each row execute function tripsplit_private.trip_invitations_check_person();

-- Puts the caller on the trip for an invitation they've claimed. For an
-- invitation to a named person, the caller takes that person's place: their
-- expenses, shares, settlements and recurring expenses move to the caller.
create function tripsplit_private.join_trip(p_invitation tripsplit.trip_invitations)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_trip uuid := p_invitation.trip_id;
  v_person uuid := p_invitation.person_id;
begin
  perform tripsplit.ensure_profile();

  if v_person is null then
    insert into tripsplit.trip_members (trip_id, user_id, role)
    values (v_trip, v_user, 'member')
    on conflict (trip_id, user_id) do nothing;
  else
    -- Someone already on the trip can't also become the named person: their
    -- shares of the same expense would collide.
    if exists (select 1 from tripsplit.trip_members m where m.trip_id = v_trip and m.user_id = v_user) then
      raise exception using errcode = 'P0001', message = 'already_on_trip';
    end if;

    insert into tripsplit.trip_members (trip_id, user_id, role) values (v_trip, v_user, 'member');

    -- Triggers keep expenses.participant_ids in step with these.
    update tripsplit.expenses set paid_by = v_user where trip_id = v_trip and paid_by = v_person;
    update tripsplit.expense_splits s
    set user_id = v_user
    from tripsplit.expenses e
    where e.id = s.expense_id and e.trip_id = v_trip and s.user_id = v_person;
    update tripsplit.settlements set from_user_id = v_user where trip_id = v_trip and from_user_id = v_person;
    update tripsplit.settlements set to_user_id = v_user where trip_id = v_trip and to_user_id = v_person;
    update tripsplit.recurring_expenses set paid_by = v_user where trip_id = v_trip and paid_by = v_person;
    update tripsplit.recurring_expenses
    set participant_ids = array_replace(participant_ids, v_person, v_user)
    where trip_id = v_trip and v_person = any (participant_ids);

    update tripsplit.trip_invitations set person_id = null where person_id = v_person;
    delete from tripsplit.profiles where id = v_person;
  end if;

  update tripsplit.trip_invitations set status = 'accepted' where id = p_invitation.id;
end;
$$;

create or replace function tripsplit.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation tripsplit.trip_invitations := tripsplit_private.claim_invitation(p_invitation_id);
begin
  perform tripsplit_private.join_trip(v_invitation);
  return v_invitation.trip_id;
end;
$$;

create or replace function tripsplit.accept_invitation_link(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation tripsplit.trip_invitations;
begin
  -- Already on the trip (e.g. opened the link twice): just go there. An unused
  -- invitation for a named person still says why it can't be used.
  select * into v_invitation from tripsplit.trip_invitations i where i.token = p_token;
  if found and exists (
    select 1 from tripsplit.trip_members m
    where m.trip_id = v_invitation.trip_id and m.user_id = (select auth.uid())
  ) then
    if v_invitation.person_id is not null and v_invitation.status = 'pending' then
      raise exception using errcode = 'P0001', message = 'already_on_trip';
    end if;
    return v_invitation.trip_id;
  end if;

  v_invitation := tripsplit_private.claim_invitation_link(p_token);
  perform tripsplit_private.join_trip(v_invitation);
  return v_invitation.trip_id;
end;
$$;

-- The preview also says whose place the invitee takes.
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
  trip_kind tripsplit.trip_kind,
  person_name text
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
    t.kind,
    person.full_name
  from tripsplit.trip_invitations i
  join tripsplit.trips t on t.id = i.trip_id
  join tripsplit.profiles p on p.id = i.invited_by
  left join tripsplit.profiles person on person.id = i.person_id
  where i.token = p_token
    and (select auth.uid()) is not null;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function
  tripsplit.add_trip_person(uuid, text),
  tripsplit.rename_trip_person(uuid, text),
  tripsplit.remove_trip_person(uuid),
  tripsplit.get_invitation_preview(uuid),
  tripsplit_private.assert_person_name(text),
  tripsplit_private.manageable_person(uuid),
  tripsplit_private.trip_invitations_check_person(),
  tripsplit_private.join_trip(tripsplit.trip_invitations)
from public;

grant execute on function
  tripsplit.add_trip_person(uuid, text),
  tripsplit.rename_trip_person(uuid, text),
  tripsplit.remove_trip_person(uuid),
  tripsplit.get_invitation_preview(uuid)
to authenticated, service_role;

grant execute on function
  tripsplit_private.assert_person_name(text),
  tripsplit_private.manageable_person(uuid),
  tripsplit_private.trip_invitations_check_person(),
  tripsplit_private.join_trip(tripsplit.trip_invitations)
to service_role;
