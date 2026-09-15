-- Read-only, staff-run reporting. Never expose these queries through an anonymous API.
-- Deleted assignments are deliberately absent, including their analytics.
with per_assignment as (
  select a.id, count(r.id) as versions from public.lab_assignments a
  left join public.lab_evaluation_runs r on r.assignment_id=a.id group by a.id
), first_assignment as (
  select owner_id, min(created_at) as first_at from public.lab_assignments group by owner_id
), mature_users as (
  select f.owner_id, exists (
    select 1 from public.lab_assignments a where a.owner_id=f.owner_id
      and a.created_at > f.first_at and a.created_at <= f.first_at + interval '30 days'
  ) as returned from first_assignment f where f.first_at <= now() - interval '30 days'
)
select
  (select count(*) from per_assignment where versions >= 1) as evaluated_assignments,
  (select count(*) from per_assignment where versions >= 2) as reevaluated_assignments,
  (select round(100.0 * count(*) filter (where versions >= 2) / nullif(count(*) filter (where versions >= 1),0),1) from per_assignment) as same_assignment_reevaluation_pct,
  (select count(*) from mature_users) as users_with_full_30_day_observation,
  (select count(*) from mature_users where returned) as second_assignment_within_30_days,
  (select count(*) from public.lab_events where event_name='revision_feedback') as revised_draft_feedback_responses,
  (select round(100.0 * count(*) filter (where (properties->>'helpful')::boolean) / nullif(count(*),0),1)
     from public.lab_events where event_name='revision_feedback') as helpful_pct;

-- Optional on the existing billing database: current subscription association only.
-- This is not an estimate of conversion, retention, or a causal treatment effect.
with cohorts as (
  select u.identity_hash, exists (
    select 1 from public.lab_assignments a join public.lab_evaluation_runs r on r.assignment_id=a.id
    where a.owner_id=u.id and r.version>=2
  ) as reevaluated
  from public.lab_users u where exists (
    select 1 from public.lab_assignments a join public.lab_evaluation_runs r on r.assignment_id=a.id where a.owner_id=u.id
  )
), billing as (
  select encode(sha256(convert_to(lower(trim(email)), 'UTF8')), 'hex') as identity_hash,
    bool_or(plan='pro' and status='active' and current_period_end >= extract(epoch from now())) as active_pro
  from public.account_entitlements where email is not null group by lower(trim(email))
)
select c.reevaluated, count(*) as users, count(*) filter (where b.active_pro) as currently_active_pro,
  round(100.0 * count(*) filter (where b.active_pro) / nullif(count(*),0),1) as current_pro_pct
from cohorts c left join billing b on b.identity_hash=c.identity_hash group by c.reevaluated;

