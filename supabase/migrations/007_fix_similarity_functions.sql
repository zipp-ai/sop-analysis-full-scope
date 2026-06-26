-- Fix: Best-match similarity instead of cross-join average
-- For each section in SOP A, find the best matching section in SOP B,
-- then average those best matches. This gives accurate similarity.

create or replace function compute_section_similarity(sop_a uuid, sop_b uuid)
returns float
language sql stable
as $$
  with best_matches as (
    select a.id as section_a_id,
           max(1 - (a.embedding <=> b.embedding)) as best_sim
    from public.sop_sections a
    cross join public.sop_sections b
    where a.sop_id = sop_a and b.sop_id = sop_b
      and a.embedding is not null and b.embedding is not null
    group by a.id
  )
  select coalesce(avg(best_sim), 0) from best_matches;
$$;

-- Per-section similarity: returns each section from SOP A with its best match from SOP B
create or replace function compute_section_pairs(sop_a_id uuid, sop_b_id uuid)
returns table (
  section_a_type text,
  section_a_heading text,
  section_a_content_preview text,
  section_b_type text,
  section_b_heading text,
  section_b_content_preview text,
  similarity float
)
language sql stable
as $$
  with matches as (
    select
      a.section_type as a_type,
      a.heading as a_heading,
      left(a.content, 200) as a_preview,
      b.section_type as b_type,
      b.heading as b_heading,
      left(b.content, 200) as b_preview,
      1 - (a.embedding <=> b.embedding) as sim,
      row_number() over (partition by a.id order by a.embedding <=> b.embedding) as rn
    from public.sop_sections a
    cross join public.sop_sections b
    where a.sop_id = sop_a_id and b.sop_id = sop_b_id
      and a.embedding is not null and b.embedding is not null
  )
  select a_type, a_heading, a_preview, b_type, b_heading, b_preview, sim
  from matches where rn = 1

  union all

  -- Sections only in SOP B (not matched)
  select null, null, null,
         b.section_type, b.heading, left(b.content, 200), 0
  from public.sop_sections b
  where b.sop_id = sop_b_id
    and b.embedding is not null
    and b.id not in (
      select (array_agg(b2.id order by a2.embedding <=> b2.embedding))[1]
      from public.sop_sections a2
      cross join public.sop_sections b2
      where a2.sop_id = sop_a_id and b2.sop_id = sop_b_id
        and a2.embedding is not null and b2.embedding is not null
      group by a2.id
    );
$$;
