-- Approved production rollout: daily retention for the server-only growth ledger.
begin;
create extension if not exists pg_cron;
select cron.schedule('rubricheck-growth-retention', '15 10 * * *', 'select public.rubricheck_growth_prune();');
commit;
