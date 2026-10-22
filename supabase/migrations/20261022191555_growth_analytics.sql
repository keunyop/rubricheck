-- Additive, intentionally NOT applied to production. Requires credits_mvp.sql.
begin;
create table public.growth_accounts (
  account_key text primary key check (account_key ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  journey text not null check (journey in ('new_account','returning_account')),
  prior_payer boolean,
  analytics_allowed boolean not null default false,
  first_paid_at timestamptz,
  first_touch jsonb,
  last_touch jsonb,
  country text not null default 'unknown'
);
create table public.growth_visitors (
  visitor_id uuid primary key,
  account_key text references public.growth_accounts(account_key) on delete set null,
  ambiguous boolean not null default false,
  first_touch jsonb,
  last_touch jsonb,
  country text not null default 'unknown',
  last_seen_at timestamptz not null default now()
);
create table public.growth_events (
  event_key text primary key,
  event_name text not null check (event_name in ('page_view','pricing_viewed','evaluation_started','guest_preview_completed','signup_completed','account_verified','evaluation_completed','evaluation_result_viewed','checkout_started','evaluation_failed','evaluation_network_failed')),
  occurred_at timestamptz not null default now(),
  visitor_id uuid references public.growth_visitors(visitor_id) on delete set null,
  account_key text references public.growth_accounts(account_key) on delete set null,
  journey text not null check (journey in ('guest','new_account','returning_account')),
  product text not null check (product in ('unknown','guest','free','credits','pro','pro_monthly','pro_annual','pro_lifetime')),
  attempt_id uuid,
  evaluation_id uuid,
  failure text check (failure in ('server','access','validation','network')),
  first_touch jsonb,
  last_touch jsonb,
  country text not null default 'unknown'
);
create index growth_events_time on public.growth_events(occurred_at);
create index growth_events_visitor_time on public.growth_events(visitor_id,occurred_at);
create index growth_events_account_time on public.growth_events(account_key,occurred_at);
create index growth_events_attempt on public.growth_events(attempt_id) where attempt_id is not null;
create index growth_events_evaluation on public.growth_events(evaluation_id) where evaluation_id is not null;
create table public.growth_payments (
  payment_key text primary key,
  account_key text references public.growth_accounts(account_key) on delete set null,
  occurred_at timestamptz not null,
  product text not null check (product in ('unknown','credits','pro_monthly','pro_annual','pro_lifetime')),
  kind text not null check (kind in ('subscription_initial','subscription_renewal','subscription_change','one_time','subscription_canceled','refund')),
  amount_minor bigint not null default 0,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  first_touch jsonb,
  last_touch jsonb,
  country text not null default 'unknown'
);
create index growth_payments_time on public.growth_payments(occurred_at);
create index growth_payments_account_time on public.growth_payments(account_key,occurred_at);
create index growth_visitors_retention on public.growth_visitors(last_seen_at);
create index growth_accounts_retention on public.growth_accounts(last_seen_at);
alter table public.growth_accounts enable row level security;
alter table public.growth_visitors enable row level security;
alter table public.growth_events enable row level security;
alter table public.growth_payments enable row level security;
revoke all on public.growth_accounts,public.growth_visitors,public.growth_events,public.growth_payments from public,anon,authenticated;
grant select,insert,update,delete on public.growth_accounts,public.growth_visitors,public.growth_events,public.growth_payments to service_role;
grant select on public.account_entitlements,public.credit_payments,public.free_usage_counters to service_role;

-- Service-role only. Raw email is used solely against the existing billing/usage
-- records, never persisted in analytics. All functions use invoker privileges.
create function public.rubricheck_growth_identify(p_account text,p_email text,p_visitor uuid,p_verified_login boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_existing boolean; v_paid boolean; v_inserted integer; v_journey text;
begin
  v_paid := exists(select 1 from public.account_entitlements where email=lower(trim(p_email)))
    or exists(select 1 from public.credit_payments where purchaser_email=lower(trim(p_email)) and amount_total>0);
  v_existing := v_paid or exists(select 1 from public.free_usage_counters where email=lower(trim(p_email)));
  insert into public.growth_accounts(account_key,journey,prior_payer)
    values(p_account,case when p_verified_login and not v_existing then 'new_account' else 'returning_account' end,v_paid)
    on conflict(account_key) do nothing;
  get diagnostics v_inserted = row_count;
  update public.growth_accounts set last_seen_at=now(),prior_payer=coalesce(prior_payer,v_paid),analytics_allowed=(p_visitor is not null) where account_key=p_account;
  if p_visitor is not null then
    update public.growth_visitors set ambiguous=ambiguous or (account_key is not null and account_key<>p_account), account_key=coalesce(account_key,p_account),last_seen_at=now() where visitor_id=p_visitor;
    update public.growth_accounts a set first_touch=coalesce(a.first_touch,v.first_touch),last_touch=coalesce(v.last_touch,a.last_touch),country=case when v.country<>'unknown' then v.country else a.country end
      from public.growth_visitors v where a.account_key=p_account and v.visitor_id=p_visitor and not v.ambiguous;
    select journey into v_journey from public.growth_accounts where account_key=p_account;
    if p_verified_login then
      insert into public.growth_events(event_key,event_name,visitor_id,account_key,journey,product,first_touch,last_touch,country)
      select case when v_inserted=1 and not v_existing then 'signup:'||p_account else 'verified:'||p_account||':'||p_visitor end,
        case when v_inserted=1 and not v_existing then 'signup_completed' else 'account_verified' end,
        p_visitor,p_account,v_journey,'free',first_touch,last_touch,country from public.growth_visitors where visitor_id=p_visitor
        on conflict do nothing;
    end if;
  end if;
end $$;

create function public.rubricheck_growth_event(p_event_key text,p_event_name text,p_visitor uuid,p_account text,p_product text,p_attempt uuid,p_evaluation uuid,p_failure text,p_touch jsonb,p_country text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_journey text := 'guest'; v_product text:=p_product; v_evaluation uuid:=p_evaluation; v_attempt uuid:=p_attempt;
begin
  if p_account is not null then
    insert into public.growth_accounts(account_key,journey) values(p_account,'returning_account') on conflict do nothing;
    select case when journey='new_account' and first_seen_at>now()-interval '7 days' then 'new_account' else 'returning_account' end into v_journey from public.growth_accounts where account_key=p_account;
  end if;
  insert into public.growth_visitors(visitor_id,account_key,first_touch,last_touch,country)
    values(p_visitor,p_account,p_touch,p_touch,p_country)
    on conflict(visitor_id) do update set last_touch=coalesce(excluded.last_touch,growth_visitors.last_touch),
      first_touch=coalesce(growth_visitors.first_touch,excluded.first_touch),last_seen_at=now(),
      ambiguous=growth_visitors.ambiguous or (growth_visitors.account_key is not null and excluded.account_key is not null and growth_visitors.account_key<>excluded.account_key),
      account_key=coalesce(growth_visitors.account_key,excluded.account_key),
      country=case when excluded.country<>'unknown' then excluded.country else growth_visitors.country end;
  if p_account is not null then
    update public.growth_accounts a set last_seen_at=now(),analytics_allowed=true,first_touch=coalesce(a.first_touch,v.first_touch),last_touch=coalesce(v.last_touch,a.last_touch),country=case when v.country<>'unknown' then v.country else a.country end
      from public.growth_visitors v where a.account_key=p_account and v.visitor_id=p_visitor and not v.ambiguous;
  end if;
  -- A browser cannot invent a successful result view without a completed server event.
  if p_event_name='evaluation_result_viewed' then
    select e.product,e.evaluation_id,e.attempt_id into v_product,v_evaluation,v_attempt from public.growth_events e
      where e.event_name in ('evaluation_completed','guest_preview_completed')
      and ((p_attempt is not null and e.attempt_id=p_attempt) or (p_evaluation is not null and e.evaluation_id=p_evaluation) or (p_attempt is null and p_evaluation is null and p_account is null and e.event_name='guest_preview_completed' and e.occurred_at>now()-interval '24 hours'))
      and (e.visitor_id=p_visitor or (p_account is not null and e.account_key=p_account)) order by e.occurred_at desc limit 1;
    if not found then return; end if;
  end if;
  insert into public.growth_events(event_key,event_name,visitor_id,account_key,journey,product,attempt_id,evaluation_id,failure,first_touch,last_touch,country)
    select p_event_key,p_event_name,p_visitor,p_account,v_journey,v_product,v_attempt,v_evaluation,p_failure,
      coalesce(a.first_touch,v.first_touch),coalesce(v.last_touch,a.last_touch),case when v.country<>'unknown' then v.country else coalesce(a.country,'unknown') end
    from public.growth_visitors v left join public.growth_accounts a on a.account_key=p_account where v.visitor_id=p_visitor on conflict do nothing;
end $$;

create function public.rubricheck_growth_payment(p_key text,p_account text,p_at timestamptz,p_product text,p_kind text,p_amount bigint,p_currency text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Old replays cannot reintroduce data removed by the retention policy.
  if p_at < now()-interval '400 days' or p_at > now()+interval '5 minutes' then return; end if;
  if p_account is not null then
    insert into public.growth_accounts(account_key,journey) values(p_account,'returning_account') on conflict do nothing;
  end if;
  insert into public.growth_payments(payment_key,account_key,occurred_at,product,kind,amount_minor,currency,first_touch,last_touch,country)
    values(p_key,p_account,p_at,p_product,p_kind,p_amount,p_currency,
      (select case when analytics_allowed and prior_payer is false then first_touch end from public.growth_accounts where account_key=p_account),
      (select case when analytics_allowed then last_touch end from public.growth_accounts where account_key=p_account),
      coalesce((select case when analytics_allowed then country end from public.growth_accounts where account_key=p_account),'unknown')) on conflict do nothing;
  if p_amount>0 and p_kind in ('one_time','subscription_initial','subscription_renewal','subscription_change') then
    update public.growth_accounts set first_paid_at=least(coalesce(first_paid_at,p_at),p_at),last_seen_at=now() where account_key=p_account;
  end if;
end $$;

create function public.rubricheck_growth_report(p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_from>=p_to or p_from<now()-interval '90 days' or p_to>now()+interval '5 minutes' then raise exception 'INVALID_REPORT_WINDOW'; end if;
  select jsonb_build_object(
    'events',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select e.*,a.prior_payer,coalesce(e.account_key,case when not v.ambiguous then v.account_key end,'visitor:'||e.visitor_id) actor from public.growth_events e left join public.growth_visitors v using(visitor_id) left join public.growth_accounts a on a.account_key=coalesce(e.account_key,case when not v.ambiguous then v.account_key end) where e.occurred_at>=p_from and e.occurred_at<p_to order by e.occurred_at,e.event_key limit 50001)x),
    'payments',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.*,a.prior_payer,a.first_paid_at from public.growth_payments p left join public.growth_accounts a using(account_key) where p.occurred_at>=p_from and p.occurred_at<p_to order by p.occurred_at,p.payment_key limit 50001)x),
    'collectionStartedAt',(select min(occurred_at) from public.growth_events),
    'generatedAt',now()) into result;
  return result;
end $$;

create function public.rubricheck_growth_opt_out(p_account text,p_visitor uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.growth_accounts set analytics_allowed=false,first_touch=null,last_touch=null,country='unknown' where account_key=p_account;
  update public.growth_visitors set first_touch=null,last_touch=null,country='unknown' where visitor_id=p_visitor;
end $$;
revoke all on function public.rubricheck_growth_opt_out(text,uuid) from public,anon,authenticated;
grant execute on function public.rubricheck_growth_opt_out(text,uuid) to service_role;

create function public.rubricheck_growth_prune() returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.growth_events where occurred_at<now()-interval '90 days';
  delete from public.growth_visitors where last_seen_at<now()-interval '90 days';
  update public.growth_accounts set first_touch=null,last_touch=null,country='unknown' where last_seen_at<now()-interval '90 days' and (first_touch is not null or last_touch is not null or country<>'unknown');
  update public.growth_payments set first_touch=null,last_touch=null,country='unknown' where occurred_at<now()-interval '90 days' and (first_touch is not null or last_touch is not null or country<>'unknown');
  delete from public.growth_payments where occurred_at<now()-interval '400 days';
  delete from public.growth_accounts where last_seen_at<now()-interval '400 days';
end $$;
revoke all on function public.rubricheck_growth_identify(text,text,uuid,boolean),public.rubricheck_growth_event(text,text,uuid,text,text,uuid,uuid,text,jsonb,text),public.rubricheck_growth_payment(text,text,timestamptz,text,text,bigint,text),public.rubricheck_growth_report(timestamptz,timestamptz),public.rubricheck_growth_prune() from public,anon,authenticated;
grant execute on function public.rubricheck_growth_identify(text,text,uuid,boolean),public.rubricheck_growth_event(text,text,uuid,text,text,uuid,uuid,text,jsonb,text),public.rubricheck_growth_payment(text,text,timestamptz,text,text,bigint,text),public.rubricheck_growth_report(timestamptz,timestamptz),public.rubricheck_growth_prune() to service_role;
commit;
