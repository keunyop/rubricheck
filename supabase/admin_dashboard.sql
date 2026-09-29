-- Apply after credits_mvp.sql, before deploying the paginated admin dashboard.
-- Existing rows are unchanged. Only the service role may call this function.
begin;

create or replace function public.rubricheck_admin_dashboard(
  p_page integer default 1,
  p_page_size integer default 25,
  p_query text default '',
  p_free_trial_limit integer default 3
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
settings as (
  select greatest(1, coalesce(p_page, 1)) as requested_page,
         greatest(1, least(100, coalesce(p_page_size, 25))) as page_size,
         left(lower(trim(coalesce(p_query, ''))), 200) as query
),
-- Prefer the subscription email; otherwise use the latest payment identity.
customer_emails as (
  select distinct on (customer_id) customer_id, email
  from (
    select trim(customer_id) as customer_id, lower(trim(email)) as email,
           0 as priority, updated_at as recorded_at, 0::bigint as id
    from account_entitlements
    where nullif(trim(email), '') is not null
    union all
    select coalesce(nullif(trim(stripe_customer_id), ''),
                    case when owner_type = 'customer' then trim(owner_id) end),
           case when owner_type = 'email' then lower(trim(owner_id))
                else lower(trim(purchaser_email)) end,
           1, created_at, id
    from credit_payments
  ) identities
  where nullif(customer_id, '') is not null and nullif(email, '') is not null
  order by customer_id, priority, recorded_at desc, id desc, email
),
sources as (
  select lower(trim(email)) as email, trim(customer_id) as customer_id,
         status, current_period_end, updated_at,
         0::bigint as credits, 0 as free_used, null::timestamptz as top_up_at
  from account_entitlements
  where nullif(trim(email), '') is not null
  union all
  select lower(trim(email)), null, null, null, null, 0, evaluate_count, null
  from free_usage_counters
  union all
  select case when l.owner_type = 'email' then lower(trim(l.owner_id)) else c.email end,
         case when l.owner_type = 'customer' then trim(l.owner_id) end,
         null, null, null, l.remaining_credits, 0, l.created_at
  from credit_lots l
  left join customer_emails c on l.owner_type = 'customer' and c.customer_id = trim(l.owner_id)
  union all
  select case when p.owner_type = 'email' then lower(trim(p.owner_id))
              else coalesce(c.email, nullif(lower(trim(p.purchaser_email)), '')) end,
         case when p.owner_type = 'customer' then trim(p.owner_id)
              else nullif(trim(p.stripe_customer_id), '') end,
         null, null, null, 0, 0, p.created_at
  from credit_payments p
  left join customer_emails c on p.owner_type = 'customer' and c.customer_id = trim(p.owner_id)
),
grouped as (
  select coalesce('email:' || nullif(email, ''), 'customer:' || nullif(customer_id, '')) as identity,
         max(nullif(email, '')) as email,
         max(nullif(customer_id, '')) as customer_id,
         (array_agg(status order by updated_at desc, customer_id)
           filter (where status is not null))[1] as status,
         (array_agg(current_period_end order by updated_at desc, customer_id)
           filter (where status is not null))[1] as current_period_end,
         max(updated_at) as updated_at,
         sum(credits) as credits,
         max(free_used) as free_used,
         max(top_up_at) as top_up_at
  from sources
  where nullif(email, '') is not null or nullif(customer_id, '') is not null
  group by coalesce('email:' || nullif(email, ''), 'customer:' || nullif(customer_id, ''))
),
subscribers as materialized (
  select *,
         case when status = 'active' and current_period_end >= extract(epoch from now())::bigint then 'pro'
              when credits > 0 then 'topup' else 'free' end as plan
  from grouped
),
filtered as materialized (
  select s.*
  from subscribers s cross join settings
  where settings.query = ''
     or strpos(coalesce(s.email, ''), settings.query) > 0
     or strpos(lower(coalesce(s.customer_id, '')), settings.query) > 0
     or strpos(s.plan, settings.query) > 0
     or strpos(coalesce(s.status, 'none'), settings.query) > 0
),
totals as (
  select count(*) as total from filtered
),
pagination as (
  select least(requested_page, greatest(1, (total + page_size - 1) / page_size)) as page,
         page_size, total, greatest(1, (total + page_size - 1) / page_size) as total_pages
  from totals cross join settings
),
page_rows as (
  select *
  from filtered
  order by case plan when 'pro' then 0 when 'topup' then 1 else 2 end,
           coalesce(top_up_at, updated_at) desc nulls last, coalesce(email, customer_id), identity
  limit (select page_size from pagination)
  offset (select (page - 1) * page_size from pagination)
)
select jsonb_build_object(
  'generatedAt', now(),
  'summary', (
    select jsonb_build_object(
      'knownUsers', count(*),
      'proUsers', count(*) filter (where plan = 'pro'),
      'topUpUsers', count(*) filter (where plan = 'topup'),
      'freeUsers', count(*) filter (where plan = 'free'),
      'remainingCredits', coalesce(sum(credits), 0)
    ) from subscribers
  ),
  'pagination', (
    select jsonb_build_object('page', page, 'pageSize', page_size, 'total', total, 'totalPages', total_pages)
    from pagination
  ),
  'subscribers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', email,
      'customerId', customer_id,
      'plan', plan,
      'subscriptionStatus', coalesce(status, 'none'),
      'currentPeriodEnd', current_period_end,
      'updatedAt', updated_at,
      'remainingCredits', credits,
      'freeEvaluationsUsed', free_used,
      'freeEvaluationsRemaining', greatest(0, coalesce(p_free_trial_limit, 3) - free_used),
      'latestTopUpAt', top_up_at
    ) order by case plan when 'pro' then 0 when 'topup' then 1 else 2 end,
               coalesce(top_up_at, updated_at) desc nulls last, coalesce(email, customer_id), identity)
    from page_rows
  ), '[]'::jsonb)
);
$$;

revoke all on function public.rubricheck_admin_dashboard(integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.rubricheck_admin_dashboard(integer, integer, text, integer) to service_role;

commit;
