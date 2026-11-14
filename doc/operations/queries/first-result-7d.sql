-- GROW-002: first observed evaluation starter -> linked valid result viewed within 7 days.
-- Change both UTC bounds to the chosen seven-day Vancouver-local window.
-- On affected Supabase Postgres versions, do not use AT TIME ZONE 'America/Vancouver'
-- to calculate 2026+ cohort boundaries. Confirm the applicable civil-time rule first.
-- Only report a window after cohort_end_utc + seven days has elapsed.
with bounds as (
  select
    timestamptz '2026-10-31 07:00:00+00' as cohort_start_utc,
    timestamptz '2026-11-07 07:00:00+00' as cohort_end_utc
), events as (
  select
    e.event_name,
    e.occurred_at,
    e.attempt_id,
    e.evaluation_id,
    coalesce(
      'a:' || e.account_key,
      case when v.ambiguous = false and v.account_key is not null
        then 'a:' || v.account_key end,
      'v:' || e.visitor_id::text
    ) as actor
  from public.growth_events e
  left join public.growth_visitors v on v.visitor_id = e.visitor_id
  where e.event_name in (
    'evaluation_started',
    'evaluation_completed',
    'guest_preview_completed',
    'evaluation_result_viewed'
  )
    and e.occurred_at < (select cohort_end_utc + interval '7 days' from bounds)
), first_starts as (
  select distinct on (actor)
    actor,
    occurred_at as started_at
  from events
  where event_name = 'evaluation_started'
  order by actor, occurred_at, attempt_id
), cohort as (
  select fs.*
  from first_starts fs
  cross join bounds b
  where fs.started_at >= b.cohort_start_utc
    and fs.started_at < b.cohort_end_utc
), classified as (
  select
    c.actor,
    exists (
      select 1
      from events s
      join events viewed
        on viewed.actor = s.actor
       and viewed.event_name = 'evaluation_result_viewed'
       and viewed.occurred_at >= s.occurred_at
       and viewed.occurred_at < c.started_at + interval '7 days'
       and (
         (s.attempt_id is not null and viewed.attempt_id = s.attempt_id)
         or (s.evaluation_id is not null and viewed.evaluation_id = s.evaluation_id)
       )
      where s.actor = c.actor
        and s.event_name in ('evaluation_completed', 'guest_preview_completed')
        and s.occurred_at >= c.started_at
        and s.occurred_at < c.started_at + interval '7 days'
    ) as viewed_7d
  from cohort c
)
select
  count(*) as first_observed_starters,
  count(*) filter (where viewed_7d) as linked_result_viewers_7d,
  round(100.0 * count(*) filter (where viewed_7d) / nullif(count(*), 0), 1)
    as linked_result_view_rate_percent
from classified;
