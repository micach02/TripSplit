-- =============================================================================
-- TripSplit · Search
--
-- tripsplit.search_expenses(query): expenses across every budget and trip the
-- caller is on, newest first. Every word in the query must match somewhere —
-- the description, notes, category, the budget or trip (name or destination),
-- or who paid or shared it — so "seafood coron" narrows things down. A number
-- also matches an amount exactly ("320", "4,800", "99.50").
--
-- SECURITY INVOKER: row-level security decides what's visible, exactly as for
-- every other read. ILIKE over a person's own expenses is plenty fast at this
-- scale; a trigram index can come later if it isn't.
-- =============================================================================

create function tripsplit.search_expenses(p_query text, p_limit integer default 40)
returns table (
  id uuid,
  trip_id uuid,
  trip_name text,
  trip_kind tripsplit.trip_kind,
  trip_currency text,
  description text,
  notes text,
  expense_date date,
  amount numeric,
  currency text,
  converted_amount numeric,
  category_name text,
  category_icon text,
  category_color text,
  paid_by uuid,
  paid_by_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    -- Up to 8 words, lower-cased, commas dropped ("4,800" → "4800"), LIKE wildcards escaped.
    select array(
      select replace(replace(replace(replace(word, ',', ''), '\', '\\'), '%', '\%'), '_', '\_')
      from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') as word
      where replace(word, ',', '') <> ''
      limit 8
    ) as list
  )
  select
    e.id,
    e.trip_id,
    t.name,
    t.kind,
    t.currency,
    e.description,
    e.notes,
    e.expense_date,
    e.amount,
    e.currency,
    e.converted_amount,
    c.name,
    c.icon,
    c.color,
    e.paid_by,
    payer.full_name
  from tripsplit.expenses e
  join tripsplit.trips t on t.id = e.trip_id
  left join tripsplit.categories c on c.id = e.category_id
  left join tripsplit.profiles payer on payer.id = e.paid_by
  cross join words
  where cardinality(words.list) > 0
    and not exists (
      select 1
      from unnest(words.list) as w(term)
      where not (
        lower(concat_ws(' ',
          e.description, e.notes, c.name, t.name, t.destination, payer.full_name,
          (select string_agg(p.full_name, ' ') from tripsplit.profiles p where p.id = any (e.participant_ids))
        )) like '%' || w.term || '%' escape '\'
        or (w.term ~ '^\d+(\.\d{1,2})?$' and (e.amount = w.term::numeric or e.converted_amount = w.term::numeric))
      )
    )
  order by e.expense_date desc, e.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function tripsplit.search_expenses(text, integer) from public;
grant execute on function tripsplit.search_expenses(text, integer) to authenticated, service_role;
