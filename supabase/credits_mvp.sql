-- RubriCheck MVP credit ledger schema for Supabase Postgres.
-- Run this once in Supabase SQL Editor with a privileged role.

create extension if not exists pgcrypto;

create table if not exists public.billing_processed_events (
  id bigserial primary key,
  scope text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  constraint billing_processed_events_scope_external_id_unique unique (scope, external_id)
);

create table if not exists public.credit_payments (
  id bigserial primary key,
  owner_type text not null check (owner_type in ('customer', 'email')),
  owner_id text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  purchaser_email text,
  credit_pack_id text,
  amount_total integer check (amount_total >= 0),
  currency text,
  total_credits integer not null check (total_credits > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.credit_lots (
  id bigserial primary key,
  payment_id bigint not null references public.credit_payments(id) on delete restrict,
  owner_type text not null check (owner_type in ('customer', 'email')),
  owner_id text not null,
  total_credits integer not null check (total_credits > 0),
  remaining_credits integer not null check (remaining_credits >= 0 and remaining_credits <= total_credits),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('customer', 'email')),
  owner_id text not null,
  billing_source text not null default 'credit',
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

create table if not exists public.credit_usage_allocations (
  id bigserial primary key,
  usage_event_id uuid not null references public.credit_usage_events(id) on delete cascade,
  lot_id bigint not null references public.credit_lots(id) on delete restrict,
  credits_used integer not null check (credits_used > 0),
  credits_refunded integer not null default 0 check (credits_refunded >= 0 and credits_refunded <= credits_used),
  created_at timestamptz not null default now(),
  constraint credit_usage_allocations_usage_event_unique unique (usage_event_id)
);

create table if not exists public.credit_refunds (
  id bigserial primary key,
  payment_id bigint references public.credit_payments(id) on delete restrict,
  stripe_refund_id text not null unique,
  refunded_credits integer not null check (refunded_credits >= 0),
  refunded_amount integer not null check (refunded_amount >= 0),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_failures (
  id bigserial primary key,
  event_id text not null,
  event_type text not null,
  customer_id text,
  subscription_id text,
  session_id text,
  request_id text,
  error_message text not null,
  failed_at timestamptz not null default now()
);

create index if not exists credit_lots_owner_created_idx
  on public.credit_lots (owner_type, owner_id, created_at, id);

create index if not exists credit_usage_events_owner_created_idx
  on public.credit_usage_events (owner_type, owner_id, created_at);

create index if not exists billing_webhook_failures_event_id_idx
  on public.billing_webhook_failures (event_id);

create or replace function public.rubricheck_mark_billing_event_processed(
  p_scope text,
  p_external_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_id bigint;
begin
  if coalesce(trim(p_scope), '') = '' or coalesce(trim(p_external_id), '') = '' then
    return false;
  end if;

  insert into public.billing_processed_events (scope, external_id)
  values (trim(p_scope), trim(p_external_id))
  on conflict (scope, external_id) do nothing
  returning id into v_inserted_id;

  return v_inserted_id is not null;
end;
$$;

create or replace function public.rubricheck_credit_balance(
  p_owner_type text,
  p_owner_id text
)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(remaining_credits), 0)::integer
  from public.credit_lots
  where owner_type = p_owner_type
    and owner_id = p_owner_id;
$$;

create or replace function public.rubricheck_migrate_credit_owner(
  p_email text,
  p_customer_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_customer text := trim(coalesce(p_customer_id, ''));
  v_updated integer := 0;
begin
  if v_email = '' or v_customer = '' then
    return 0;
  end if;

  update public.credit_payments
  set owner_type = 'customer',
      owner_id = v_customer
  where owner_type = 'email'
    and owner_id = v_email;
  get diagnostics v_updated = row_count;

  update public.credit_lots
  set owner_type = 'customer',
      owner_id = v_customer,
      updated_at = now()
  where owner_type = 'email'
    and owner_id = v_email;

  update public.credit_usage_events
  set owner_type = 'customer',
      owner_id = v_customer
  where owner_type = 'email'
    and owner_id = v_email;

  return v_updated;
end;
$$;

create or replace function public.rubricheck_grant_credit_purchase(
  p_owner_type text,
  p_owner_id text,
  p_credits integer,
  p_checkout_session_id text default null,
  p_payment_intent_id text default null,
  p_customer_id text default null,
  p_email text default null,
  p_credit_pack_id text default null,
  p_amount_total integer default null,
  p_currency text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_type text := trim(coalesce(p_owner_type, ''));
  v_owner_id text := trim(coalesce(p_owner_id, ''));
  v_credits integer := coalesce(p_credits, 0);
  v_checkout_session_id text := nullif(trim(coalesce(p_checkout_session_id, '')), '');
  v_payment_intent_id text := nullif(trim(coalesce(p_payment_intent_id, '')), '');
  v_customer_id text := nullif(trim(coalesce(p_customer_id, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_pack_id text := nullif(trim(coalesce(p_credit_pack_id, '')), '');
  v_currency text := nullif(lower(trim(coalesce(p_currency, ''))), '');
  v_payment_id bigint;
  v_balance integer;
begin
  if v_owner_type not in ('customer', 'email') then
    raise exception 'INVALID_OWNER_TYPE';
  end if;

  if v_owner_id = '' then
    raise exception 'INVALID_OWNER_ID';
  end if;

  if v_credits <= 0 then
    raise exception 'INVALID_CREDITS';
  end if;

  insert into public.credit_payments (
    owner_type,
    owner_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_customer_id,
    purchaser_email,
    credit_pack_id,
    amount_total,
    currency,
    total_credits
  )
  values (
    v_owner_type,
    v_owner_id,
    v_checkout_session_id,
    v_payment_intent_id,
    v_customer_id,
    v_email,
    v_pack_id,
    p_amount_total,
    v_currency,
    v_credits
  )
  on conflict do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select coalesce(sum(remaining_credits), 0)::integer
    into v_balance
    from public.credit_lots
    where owner_type = v_owner_type
      and owner_id = v_owner_id;
    return v_balance;
  end if;

  insert into public.credit_lots (
    payment_id,
    owner_type,
    owner_id,
    total_credits,
    remaining_credits
  )
  values (
    v_payment_id,
    v_owner_type,
    v_owner_id,
    v_credits,
    v_credits
  );

  select coalesce(sum(remaining_credits), 0)::integer
  into v_balance
  from public.credit_lots
  where owner_type = v_owner_type
    and owner_id = v_owner_id;

  return v_balance;
end;
$$;

create or replace function public.rubricheck_reserve_one_credit(
  p_owner_type text,
  p_owner_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_type text := trim(coalesce(p_owner_type, ''));
  v_owner_id text := trim(coalesce(p_owner_id, ''));
  v_lot_id bigint;
  v_usage_event_id uuid;
  v_balance integer;
begin
  if v_owner_type not in ('customer', 'email') then
    return jsonb_build_object(
      'reserved', false,
      'balance_after', 0,
      'usage_event_id', null,
      'lot_id', null
    );
  end if;

  if v_owner_id = '' then
    return jsonb_build_object(
      'reserved', false,
      'balance_after', 0,
      'usage_event_id', null,
      'lot_id', null
    );
  end if;

  select l.id
  into v_lot_id
  from public.credit_lots l
  where l.owner_type = v_owner_type
    and l.owner_id = v_owner_id
    and l.remaining_credits > 0
  order by l.created_at asc, l.id asc
  for update skip locked
  limit 1;

  if v_lot_id is null then
    select coalesce(sum(remaining_credits), 0)::integer
    into v_balance
    from public.credit_lots
    where owner_type = v_owner_type
      and owner_id = v_owner_id;

    return jsonb_build_object(
      'reserved', false,
      'balance_after', v_balance,
      'usage_event_id', null,
      'lot_id', null
    );
  end if;

  update public.credit_lots
  set remaining_credits = remaining_credits - 1,
      updated_at = now()
  where id = v_lot_id;

  insert into public.credit_usage_events (owner_type, owner_id, billing_source)
  values (v_owner_type, v_owner_id, 'credit')
  returning id into v_usage_event_id;

  insert into public.credit_usage_allocations (usage_event_id, lot_id, credits_used)
  values (v_usage_event_id, v_lot_id, 1);

  select coalesce(sum(remaining_credits), 0)::integer
  into v_balance
  from public.credit_lots
  where owner_type = v_owner_type
    and owner_id = v_owner_id;

  return jsonb_build_object(
    'reserved', true,
    'balance_after', v_balance,
    'usage_event_id', v_usage_event_id,
    'lot_id', v_lot_id
  );
end;
$$;

create or replace function public.rubricheck_refund_credit_reservation(
  p_usage_event_id uuid,
  p_owner_type text,
  p_owner_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_type text := trim(coalesce(p_owner_type, ''));
  v_owner_id text := trim(coalesce(p_owner_id, ''));
  v_lot_id bigint;
  v_refund_amount integer;
  v_balance integer;
begin
  if p_usage_event_id is null then
    select coalesce(sum(remaining_credits), 0)::integer
    into v_balance
    from public.credit_lots
    where owner_type = v_owner_type
      and owner_id = v_owner_id;
    return v_balance;
  end if;

  select a.lot_id, a.credits_used
  into v_lot_id, v_refund_amount
  from public.credit_usage_events e
  join public.credit_usage_allocations a on a.usage_event_id = e.id
  where e.id = p_usage_event_id
    and e.owner_type = v_owner_type
    and e.owner_id = v_owner_id
    and e.refunded_at is null
  for update of e;

  if v_lot_id is null then
    select coalesce(sum(remaining_credits), 0)::integer
    into v_balance
    from public.credit_lots
    where owner_type = v_owner_type
      and owner_id = v_owner_id;
    return v_balance;
  end if;

  update public.credit_usage_events
  set refunded_at = now()
  where id = p_usage_event_id
    and refunded_at is null;

  update public.credit_usage_allocations
  set credits_refunded = credits_used
  where usage_event_id = p_usage_event_id;

  update public.credit_lots
  set remaining_credits = least(total_credits, remaining_credits + coalesce(v_refund_amount, 0)),
      updated_at = now()
  where id = v_lot_id;

  select coalesce(sum(remaining_credits), 0)::integer
  into v_balance
  from public.credit_lots
  where owner_type = v_owner_type
    and owner_id = v_owner_id;

  return v_balance;
end;
$$;

create or replace function public.rubricheck_log_webhook_failure(
  p_event_id text,
  p_event_type text,
  p_customer_id text default null,
  p_subscription_id text default null,
  p_session_id text default null,
  p_request_id text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_webhook_failures (
    event_id,
    event_type,
    customer_id,
    subscription_id,
    session_id,
    request_id,
    error_message
  )
  values (
    coalesce(trim(p_event_id), ''),
    coalesce(trim(p_event_type), ''),
    nullif(trim(coalesce(p_customer_id, '')), ''),
    nullif(trim(coalesce(p_subscription_id, '')), ''),
    nullif(trim(coalesce(p_session_id, '')), ''),
    nullif(trim(coalesce(p_request_id, '')), ''),
    coalesce(p_error_message, 'unknown')
  );
end;
$$;

revoke all on function public.rubricheck_mark_billing_event_processed(text, text) from public, anon, authenticated;
revoke all on function public.rubricheck_credit_balance(text, text) from public, anon, authenticated;
revoke all on function public.rubricheck_migrate_credit_owner(text, text) from public, anon, authenticated;
revoke all on function public.rubricheck_grant_credit_purchase(text, text, integer, text, text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.rubricheck_reserve_one_credit(text, text) from public, anon, authenticated;
revoke all on function public.rubricheck_refund_credit_reservation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rubricheck_log_webhook_failure(text, text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.rubricheck_mark_billing_event_processed(text, text) to service_role;
grant execute on function public.rubricheck_credit_balance(text, text) to service_role;
grant execute on function public.rubricheck_migrate_credit_owner(text, text) to service_role;
grant execute on function public.rubricheck_grant_credit_purchase(text, text, integer, text, text, text, text, text, integer, text) to service_role;
grant execute on function public.rubricheck_reserve_one_credit(text, text) to service_role;
grant execute on function public.rubricheck_refund_credit_reservation(uuid, text, text) to service_role;
grant execute on function public.rubricheck_log_webhook_failure(text, text, text, text, text, text, text) to service_role;
