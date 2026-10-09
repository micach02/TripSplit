-- =============================================================================
-- TripSplit · Storage: trip cover photos
--
-- Private bucket — covers are visible to the trip's members only, through
-- signed URLs. Objects live at tripsplit-trip-covers/<trip id>/<file>; members
-- can read, only the trip owner can upload, replace or delete.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tripsplit-trip-covers', 'tripsplit-trip-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- The trip id from an object path, or null when the first folder isn't a uuid.
create function tripsplit_private.trip_id_from_object(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function tripsplit_private.trip_id_from_object(text) from public;
grant execute on function tripsplit_private.trip_id_from_object(text) to authenticated, service_role;

create policy "TripSplit covers: members can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tripsplit-trip-covers'
    and tripsplit_private.is_trip_member(tripsplit_private.trip_id_from_object(name))
  );

create policy "TripSplit covers: owners can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tripsplit-trip-covers'
    and tripsplit_private.is_trip_owner(tripsplit_private.trip_id_from_object(name))
  );

create policy "TripSplit covers: owners can replace"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'tripsplit-trip-covers'
    and tripsplit_private.is_trip_owner(tripsplit_private.trip_id_from_object(name))
  )
  with check (
    bucket_id = 'tripsplit-trip-covers'
    and tripsplit_private.is_trip_owner(tripsplit_private.trip_id_from_object(name))
  );

create policy "TripSplit covers: owners can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tripsplit-trip-covers'
    and tripsplit_private.is_trip_owner(tripsplit_private.trip_id_from_object(name))
  );
