-- Read-only aggregate audit. Contains no customer identifiers or assignment data.
select jsonb_build_object(
'snapshot_utc',now(),
'period_start','2026-10-01T07:00:00Z',
'period_end_exclusive',least(now(),'2026-10-23T07:00:00Z'::timestamptz),
'entitlements',(select coalesce(jsonb_agg(x),'[]') from (select plan,status,count(*) rows,count(distinct email) accounts,count(*) filter(where current_period_end > extract(epoch from now())) unexpired from public.account_entitlements group by plan,status)x),
'credit_payments_all',(select coalesce(jsonb_agg(x),'[]') from (select currency,credit_pack_id,count(*) payments,count(distinct coalesce(purchaser_email,owner_id)) purchasers,sum(amount_total) amount_minor_units,min(created_at) earliest,max(created_at) latest,count(*) filter(where stripe_checkout_session_id like 'cs_live_%') live_sessions,count(*) filter(where stripe_checkout_session_id like 'cs_test_%') test_sessions from public.credit_payments group by currency,credit_pack_id)x),
'credit_payments_mtd',(select coalesce(jsonb_agg(x),'[]') from (select currency,count(*) payments,count(distinct coalesce(purchaser_email,owner_id)) purchasers,sum(amount_total) amount_minor_units from public.credit_payments where created_at >= '2026-10-01T07:00:00Z' and created_at < least(now(),'2026-10-23T07:00:00Z'::timestamptz) group by currency)x),
'credit_refunds_mtd',(select count(*) from public.credit_refunds where created_at >= '2026-10-01T07:00:00Z' and created_at < least(now(),'2026-10-23T07:00:00Z'::timestamptz)),
'usage_mtd',(select coalesce(jsonb_agg(x),'[]') from (select billing_source,count(*) attempts,count(*) filter(where refunded_at is null) not_refunded,count(distinct owner_type||':'||owner_id) actors from public.credit_usage_events where created_at >= '2026-10-01T07:00:00Z' and created_at < least(now(),'2026-10-23T07:00:00Z'::timestamptz) group by billing_source)x),
'free_reservations_mtd',(select coalesce(jsonb_agg(x),'[]') from (select status,count(*) requests,count(distinct email) actors from public.free_evaluate_reservations where created_at >= '2026-10-01T07:00:00Z' and created_at < least(now(),'2026-10-23T07:00:00Z'::timestamptz) group by status)x),
'free_counters',(select jsonb_build_object('actors',count(*),'all_time_evaluations',sum(evaluate_count),'latest',max(updated_at)) from public.free_usage_counters),
'webhook_failures_mtd',(select coalesce(jsonb_agg(x),'[]') from (select event_type,count(*) failures from public.billing_webhook_failures where failed_at >= '2026-10-01T07:00:00Z' and failed_at < least(now(),'2026-10-23T07:00:00Z'::timestamptz) group by event_type)x),
'processed_events',(select coalesce(jsonb_agg(x),'[]') from(select scope,count(*) events,min(created_at) earliest,max(created_at) latest from public.billing_processed_events group by scope)x)
) as audit;
