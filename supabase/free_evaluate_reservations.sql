-- Apply after credits_mvp.sql and before deploying the reservation-aware API.
begin;
create table if not exists public.free_evaluate_reservations (
  id uuid primary key,
  email text not null references public.free_usage_counters(email),
  request_key text not null check (length(request_key) between 1 and 256),
  status text not null check (status in ('pending', 'succeeded', 'released')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  settled_at timestamptz
);
create index if not exists free_evaluate_reservations_email_idx on public.free_evaluate_reservations(email, status, expires_at);
create unique index if not exists free_evaluate_reservations_active_request_idx
  on public.free_evaluate_reservations(email, request_key) where status <> 'released';
alter table public.free_evaluate_reservations enable row level security;
revoke all on public.free_evaluate_reservations from public, anon, authenticated;

create or replace function public.rubricheck_reserve_free_evaluate(
  p_email text, p_limit integer, p_request_key text, p_reservation_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_count integer;
  v_pending integer;
  v_status text;
  v_existing_id uuid;
begin
  if v_email is null or p_limit is null or p_limit < 0 or p_reservation_id is null
    or p_request_key is null or length(p_request_key) not between 1 and 256 then
    raise exception 'INVALID_FREE_USAGE_RESERVATION';
  end if;
  insert into public.free_usage_counters(email) values (v_email) on conflict do nothing;
  -- All mutations lock the account first to serialize concurrent requests.
  select evaluate_count into v_count from public.free_usage_counters where email = v_email for update;
  update public.free_evaluate_reservations set status = 'released', settled_at = now()
    where email = v_email and status = 'pending' and expires_at <= now();
  select count(*)::integer into v_pending from public.free_evaluate_reservations where email = v_email and status = 'pending';
  select status, id into v_status, v_existing_id from public.free_evaluate_reservations
    where email = v_email and request_key = p_request_key and status <> 'released';
  if v_status is not null then
    return jsonb_build_object('status', case when v_status = 'pending' and v_existing_id = p_reservation_id then 'reserved' else v_status end,
      'count', v_count + v_pending, 'remaining', greatest(p_limit - v_count - v_pending, 0));
  end if;
  if v_count + v_pending >= p_limit then
    -- Temporary holds must not push another request into paid credit usage.
    return jsonb_build_object('status', case when v_count < p_limit then 'pending' else 'exhausted' end,
      'count', v_count + v_pending, 'remaining', 0);
  end if;
  insert into public.free_evaluate_reservations(id, email, request_key, status)
    values (p_reservation_id, v_email, p_request_key, 'pending');
  return jsonb_build_object('status', 'reserved', 'count', v_count + v_pending + 1,
    'remaining', greatest(p_limit - v_count - v_pending - 1, 0));
end;
$$;

create or replace function public.rubricheck_settle_free_evaluate(
  p_email text, p_reservation_id uuid, p_succeeded boolean, p_limit integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_count integer;
  v_pending integer;
  v_reservation public.free_evaluate_reservations%rowtype;
  v_allowed boolean := false;
begin
  select evaluate_count into v_count from public.free_usage_counters where email = v_email for update;
  select * into v_reservation from public.free_evaluate_reservations
    where email = v_email and id = p_reservation_id for update;
  if found then
    if v_reservation.status = 'pending' then
      if p_succeeded and v_reservation.expires_at > now() then
        update public.free_usage_counters set evaluate_count = evaluate_count + 1, updated_at = now()
          where email = v_email returning evaluate_count into v_count;
        update public.free_evaluate_reservations set status = 'succeeded', settled_at = now() where id = p_reservation_id;
        v_allowed := true;
      else
        update public.free_evaluate_reservations set status = 'released', settled_at = now() where id = p_reservation_id;
        v_allowed := not p_succeeded;
      end if;
    else
      -- Repeated confirmation/refund never changes the counter twice.
      v_allowed := (p_succeeded and v_reservation.status = 'succeeded')
        or (not p_succeeded and v_reservation.status = 'released');
    end if;
  else
    v_allowed := not p_succeeded;
  end if;
  select count(*)::integer into v_pending from public.free_evaluate_reservations
    where email = v_email and status = 'pending' and expires_at > now();
  return jsonb_build_object('allowed', v_allowed, 'count', coalesce(v_count, 0) + v_pending,
    'remaining', greatest(p_limit - coalesce(v_count, 0) - v_pending, 0));
end;
$$;

-- Summaries include active holds, but expired holds cannot exhaust a trial.
create or replace function public.rubricheck_get_free_evaluate_usage_count(p_email text)
returns integer language sql security definer set search_path = public as $$
  select coalesce((select evaluate_count from public.free_usage_counters where email = lower(trim(p_email))), 0)
    + (select count(*)::integer from public.free_evaluate_reservations
      where email = lower(trim(p_email)) and status = 'pending' and expires_at > now());
$$;
revoke all on function public.rubricheck_reserve_free_evaluate(text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.rubricheck_settle_free_evaluate(text, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.rubricheck_reserve_free_evaluate(text, integer, text, uuid) to service_role;
grant execute on function public.rubricheck_settle_free_evaluate(text, uuid, boolean, integer) to service_role;
commit;
