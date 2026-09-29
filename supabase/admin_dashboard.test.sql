-- Run on an EMPTY disposable database after credits_mvp.sql and admin_dashboard.sql.
-- All fixture data is rolled back.
begin;
insert into public.free_usage_counters(email, evaluate_count)
select 'paging-' || lpad(n::text, 3, '0') || '@test.invalid', n % 4
from generate_series(1, 61) n;
insert into public.free_usage_counters(email, evaluate_count) values ('pro@test.invalid', 2);
insert into public.account_entitlements(customer_id, email, plan, status, current_period_end) values
('cus_pro', ' Pro@Test.Invalid ', 'pro', 'active', extract(epoch from now())::bigint + 3600),
('cus_canceled', 'canceled@test.invalid', 'pro', 'canceled', extract(epoch from now())::bigint + 3600),
('cus_expired', 'expired@test.invalid', 'pro', 'active', 1);
insert into public.credit_payments(owner_type, owner_id, stripe_customer_id, purchaser_email, total_credits) values
('customer', 'cus_pro', 'cus_pro', 'pro@test.invalid', 7),
('customer', 'cus_topup', 'cus_topup', 'topup@test.invalid', 4),
('email', ' TOPUP@Test.Invalid ', 'cus_topup', 'topup@test.invalid', 5),
('customer', 'cus_unknown', null, null, 2);
insert into public.credit_lots(payment_id, owner_type, owner_id, total_credits, remaining_credits)
select id, owner_type, owner_id, total_credits, total_credits from public.credit_payments;

do $$
declare
  r jsonb;
  first_page jsonb;
  all_rows jsonb;
begin
  r := rubricheck_admin_dashboard();
  first_page := r;
  assert jsonb_array_length(r->'subscribers') = 25, 'default page is bounded';
  assert r->'summary' = '{"knownUsers":66,"proUsers":1,"topUpUsers":2,"freeUsers":63,"remainingCredits":18}'::jsonb,
    'identities deduplicate without multiplying credits';
  assert r->'pagination' = '{"page":1,"pageSize":25,"total":66,"totalPages":3}'::jsonb;
  assert r->'subscribers'->0->>'email' = 'pro@test.invalid', 'Pro sorts first';
  assert (r->'subscribers'->0->>'freeEvaluationsRemaining')::int = 1, 'trial usage joins by normalized email';
  all_rows := r->'subscribers';
  r := rubricheck_admin_dashboard(2);
  all_rows := all_rows || (r->'subscribers');
  assert r->'summary' = first_page->'summary', 'summary is independent of page';
  r := rubricheck_admin_dashboard(999);
  assert r->'pagination'->>'page' = '3', 'out of range page clamps';
  assert jsonb_array_length(r->'subscribers') = 16;
  all_rows := all_rows || (r->'subscribers');
  assert (select count(distinct coalesce(value->>'email', value->>'customerId')) from jsonb_array_elements(all_rows)) = 66,
    'stable pages have no duplicate or missing identities';

  r := rubricheck_admin_dashboard(2, 25, ' PAGING-061@TEST.INVALID ');
  assert r->'pagination'->>'total' = '1', 'search applies before pagination';
  assert r->'pagination'->>'page' = '1';
  assert r->'subscribers'->0->>'email' = 'paging-061@test.invalid';
  assert r->'summary' = first_page->'summary', 'search does not change summary';
  r := rubricheck_admin_dashboard(1, 25, 'CUS_UNKNOWN');
  assert r->'pagination'->>'total' = '1', 'customer ID search is case insensitive';
  r := rubricheck_admin_dashboard(1, 25, 'topup');
  assert r->'pagination'->>'total' = '2', 'search covers plan';
  r := rubricheck_admin_dashboard(1, 25, 'canceled');
  assert r->'pagination'->>'total' = '1', 'search covers subscription status';
  r := rubricheck_admin_dashboard(99, 25, '%');
  assert r->'pagination' = '{"page":1,"pageSize":25,"total":0,"totalPages":1}'::jsonb,
    'search treats SQL wildcard characters literally';
  assert r->'subscribers' = '[]'::jsonb;
  r := rubricheck_admin_dashboard(1, 999);
  assert r->'pagination'->>'pageSize' = '100', 'RPC also caps page size';
  r := rubricheck_admin_dashboard(1, 25, 'pro@test.invalid', 10);
  assert r->'subscribers'->0->>'freeEvaluationsRemaining' = '8', 'configured free trial limit is used';
  assert not has_function_privilege('anon', 'rubricheck_admin_dashboard(integer,integer,text,integer)', 'execute');
  assert not has_function_privilege('authenticated', 'rubricheck_admin_dashboard(integer,integer,text,integer)', 'execute');
  assert has_function_privilege('service_role', 'rubricheck_admin_dashboard(integer,integer,text,integer)', 'execute');
end;
$$;

-- The old application-side reader silently stopped after 50,000 source rows.
insert into public.free_usage_counters(email)
select 'large-' || lpad(n::text, 6, '0') || '@test.invalid' from generate_series(1, 50010) n;
do $$
declare r jsonb;
begin
  r := rubricheck_admin_dashboard(501, 100, 'large-');
  assert r->'pagination'->>'total' = '50010';
  assert jsonb_array_length(r->'subscribers') = 10;
  assert r->'subscribers'->9->>'email' = 'large-050010@test.invalid';
  assert r->'summary'->>'knownUsers' = '50076';
end;
$$;
rollback;
