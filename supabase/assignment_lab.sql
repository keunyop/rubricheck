-- Private assignment revision lab. Additive: does not change billing/evaluation tables.
begin;

create table if not exists public.lab_users (
  id uuid primary key default gen_random_uuid(),
  identity_hash text not null unique check (identity_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.lab_assignments (
  id uuid primary key,
  owner_id uuid not null references public.lab_users(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  initial_draft text not null check (length(initial_draft) between 1 and 60000),
  mode text not null check (mode in ('standard', 'strict')),
  created_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  unique (id, owner_id)
);
create index if not exists lab_assignments_owner on public.lab_assignments(owner_id);
create table if not exists public.lab_rubric_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.lab_assignments(id) on delete cascade,
  raw_text text not null check (length(raw_text) between 1 and 60000),
  structured jsonb,
  structure_model text,
  created_at timestamptz not null default now()
);
create table if not exists public.lab_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.lab_assignments(id) on delete cascade,
  rubric_version_id uuid not null references public.lab_rubric_versions(id) on delete cascade,
  version integer not null check (version > 0),
  draft_text text not null check (length(draft_text) between 1 and 60000),
  input_hash text not null,
  conditions jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, version),
  unique (assignment_id, input_hash)
);
create table if not exists public.lab_revision_tasks (
  run_id uuid not null references public.lab_evaluation_runs(id) on delete cascade,
  task_key uuid not null,
  data jsonb not null,
  user_done boolean not null default false,
  primary key (run_id, task_key)
);
create table if not exists public.lab_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.lab_users(id) on delete cascade,
  assignment_id uuid not null references public.lab_assignments(id) on delete cascade,
  run_id uuid references public.lab_evaluation_runs(id) on delete cascade,
  event_name text not null check (event_name in ('assignment_created','evaluation_started','evaluation_completed','result_reused','revision_feedback')),
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists lab_events_owner_time on public.lab_events(owner_id, created_at);
create unique index if not exists lab_feedback_once on public.lab_events(run_id) where event_name = 'revision_feedback';

-- Service-role-only access. Every callable function additionally filters by the verified owner UUID.
alter table public.lab_users enable row level security;
alter table public.lab_assignments enable row level security;
alter table public.lab_rubric_versions enable row level security;
alter table public.lab_evaluation_runs enable row level security;
alter table public.lab_revision_tasks enable row level security;
alter table public.lab_events enable row level security;
revoke all on public.lab_users, public.lab_assignments, public.lab_rubric_versions, public.lab_evaluation_runs, public.lab_revision_tasks, public.lab_events from public, anon, authenticated;

create or replace function public.lab_resolve_user(p_identity_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into lab_users(identity_hash) values (p_identity_hash) on conflict (identity_hash) do nothing;
  select id into v_id from lab_users where identity_hash = p_identity_hash;
  return v_id;
end $$;

create or replace function public.lab_list_assignments(p_owner uuid)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc, a.id), '[]'::jsonb)
  from (select a.id, a.title, a.created_at,
    (select count(*) from lab_evaluation_runs r where r.assignment_id = a.id) as run_count
    from lab_assignments a where a.owner_id = p_owner) a;
$$;

create or replace function public.lab_get_workspace(p_owner uuid, p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assignment lab_assignments; v_rubric lab_rubric_versions; v_runs jsonb;
begin
  select * into v_assignment from lab_assignments where id = p_assignment and owner_id = p_owner;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
  select * into strict v_rubric from lab_rubric_versions where assignment_id = p_assignment;
  select coalesce(jsonb_agg(
    (to_jsonb(r) - 'assignment_id' - 'rubric_version_id') ||
    jsonb_build_object('tasks', (select coalesce(jsonb_agg(t.data || jsonb_build_object('task_key', t.task_key, 'user_done', t.user_done)
      order by (t.data->>'criterion_index')::int, t.task_key), '[]'::jsonb)
      from lab_revision_tasks t where t.run_id = r.id)) order by r.version), '[]'::jsonb)
    into v_runs from lab_evaluation_runs r where r.assignment_id = p_assignment;
  return jsonb_build_object(
    'assignment', jsonb_build_object('id', v_assignment.id, 'title', v_assignment.title, 'created_at', v_assignment.created_at,
      'initial_draft', v_assignment.initial_draft, 'mode', v_assignment.mode, 'run_count', jsonb_array_length(v_runs)),
    'rubric', jsonb_build_object('id', v_rubric.id, 'raw_text', v_rubric.raw_text, 'structured', v_rubric.structured, 'structure_model', v_rubric.structure_model),
    'runs', v_runs);
end $$;

create or replace function public.lab_create_assignment(p_owner uuid, p_id uuid, p_title text, p_rubric text, p_draft text, p_mode text, p_pro boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_existing lab_assignments;
begin
  perform 1 from lab_users where id = p_owner for update;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
  select * into v_existing from lab_assignments where id = p_id;
  if found then
    if v_existing.owner_id <> p_owner then raise exception 'LAB_NOT_FOUND'; end if;
    if v_existing.title <> p_title or v_existing.initial_draft <> p_draft or v_existing.mode <> p_mode
      or not exists (select 1 from lab_rubric_versions where assignment_id = p_id and raw_text = p_rubric)
      then raise exception 'LAB_STALE'; end if;
    return p_id;
  end if;
  if (select count(*) from lab_assignments where owner_id = p_owner) >= (case when p_pro then 100 else 1 end)
    then raise exception 'LAB_ASSIGNMENT_LIMIT'; end if;
  insert into lab_assignments(id, owner_id, title, initial_draft, mode) values (p_id, p_owner, p_title, p_draft, p_mode);
  insert into lab_rubric_versions(assignment_id, raw_text) values (p_id, p_rubric);
  insert into lab_events(owner_id, assignment_id, event_name, properties) values (p_owner, p_id, 'assignment_created', jsonb_build_object('plan', case when p_pro then 'pro' else 'free' end));
  return p_id;
end $$;

create or replace function public.lab_begin_run(p_owner uuid, p_assignment uuid, p_hash text, p_token uuid, p_pro boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assignment lab_assignments; v_existing uuid;
begin
  perform 1 from lab_users where id = p_owner for update;
  select * into v_assignment from lab_assignments where id = p_assignment and owner_id = p_owner for update;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
  select id into v_existing from lab_evaluation_runs where assignment_id = p_assignment and input_hash = p_hash;
  if found then
    -- Reuse does not consume a version or call a model, even after downgrade.
    return jsonb_build_object('reused', true, 'run_id', v_existing);
  end if;
  if exists (select 1 from lab_assignments where owner_id = p_owner and lease_until > now()) then raise exception 'LAB_PENDING'; end if;
  if (select count(*) from lab_evaluation_runs where assignment_id = p_assignment) >= (case when p_pro then 50 else 2 end)
    then raise exception 'LAB_VERSION_LIMIT'; end if;
  if (select count(*) from lab_events where owner_id = p_owner and event_name = 'evaluation_started' and created_at > now() - interval '1 hour') >= 20
    then raise exception 'LAB_RATE_LIMIT'; end if;
  update lab_assignments set lease_token = p_token, lease_until = now() + interval '6 minutes' where id = p_assignment;
  insert into lab_events(owner_id, assignment_id, event_name) values (p_owner, p_assignment, 'evaluation_started');
  return jsonb_build_object('reused', false);
end $$;

create or replace function public.lab_finish_run(p_owner uuid, p_assignment uuid, p_token uuid, p_hash text, p_draft text, p_conditions jsonb, p_rubric jsonb, p_result jsonb, p_tasks jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assignment lab_assignments; v_rubric lab_rubric_versions; v_run uuid; v_version int; v_task jsonb; v_previous text;
begin
  select * into v_assignment from lab_assignments where id = p_assignment and owner_id = p_owner for update;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
  -- Retrying a successful commit after a lost response is idempotent.
  select id into v_run from lab_evaluation_runs where assignment_id = p_assignment and input_hash = p_hash;
  if found then return v_run; end if;
  if v_assignment.lease_token is distinct from p_token or v_assignment.lease_until <= now() then raise exception 'LAB_STALE'; end if;
  select * into strict v_rubric from lab_rubric_versions where assignment_id = p_assignment;
  if p_conditions->>'rubricVersionId' <> v_rubric.id::text or p_conditions->>'mode' <> v_assignment.mode then raise exception 'LAB_STALE'; end if;
  if v_rubric.structured is not null and v_rubric.structured <> p_rubric then raise exception 'LAB_STALE'; end if;
  update lab_rubric_versions set structured = p_rubric, structure_model = p_conditions->>'structureModel' where id = v_rubric.id;
  select coalesce(max(version), 0) + 1 into v_version from lab_evaluation_runs where assignment_id = p_assignment;
  select draft_text into v_previous from lab_evaluation_runs where assignment_id = p_assignment order by version desc limit 1;
  insert into lab_evaluation_runs(assignment_id, rubric_version_id, version, draft_text, input_hash, conditions, result)
    values (p_assignment, v_rubric.id, v_version, p_draft, p_hash, p_conditions, p_result) returning id into v_run;
  for v_task in select value from jsonb_array_elements(p_tasks) loop
    insert into lab_revision_tasks(run_id, task_key, data, user_done)
      values (v_run, (v_task->>'task_key')::uuid, v_task - 'task_key' - 'user_done', false);
  end loop;
  update lab_assignments set lease_token = null, lease_until = null where id = p_assignment;
  insert into lab_events(owner_id, assignment_id, run_id, event_name, properties)
    values (p_owner, p_assignment, v_run, 'evaluation_completed', jsonb_build_object('version', v_version, 'draft_changed', coalesce(v_previous <> p_draft, false)));
  return v_run;
end $$;

create or replace function public.lab_release_run(p_owner uuid, p_assignment uuid, p_token uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update lab_assignments set lease_token = null, lease_until = null where id = p_assignment and owner_id = p_owner and lease_token = p_token;
$$;

create or replace function public.lab_set_task(p_owner uuid, p_assignment uuid, p_run uuid, p_task uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update lab_revision_tasks t set user_done = p_done
    from lab_evaluation_runs r, lab_assignments a
    where t.run_id = p_run and t.task_key = p_task and r.id = t.run_id and r.assignment_id = a.id
      and a.id = p_assignment and a.owner_id = p_owner;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
end $$;

create or replace function public.lab_save_feedback(p_owner uuid, p_assignment uuid, p_run uuid, p_helpful boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from lab_evaluation_runs r join lab_assignments a on a.id = r.assignment_id
    where r.id = p_run and a.id = p_assignment and a.owner_id = p_owner and r.version > 1
    and r.draft_text <> (select draft_text from lab_evaluation_runs where assignment_id = a.id and version = r.version - 1))
    then raise exception 'LAB_NOT_FOUND'; end if;
  insert into lab_events(owner_id, assignment_id, run_id, event_name, properties)
    values (p_owner, p_assignment, p_run, 'revision_feedback', jsonb_build_object('helpful', p_helpful))
    on conflict (run_id) where event_name = 'revision_feedback' do update set properties = excluded.properties;
end $$;

create or replace function public.lab_export_workspace(p_owner uuid, p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_workspace jsonb; v_events jsonb;
begin
  v_workspace := lab_get_workspace(p_owner, p_assignment);
  select coalesce(jsonb_agg(jsonb_build_object('event_name', event_name, 'run_id', run_id, 'properties', properties, 'created_at', created_at) order by created_at), '[]'::jsonb)
    into v_events from lab_events where owner_id = p_owner and assignment_id = p_assignment;
  return v_workspace || jsonb_build_object('events', v_events, 'export_version', 1);
end $$;

create or replace function public.lab_delete_assignment(p_owner uuid, p_assignment uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Cascade removes drafts, rubrics, runs, checklists and assignment analytics.
  delete from lab_assignments where id = p_assignment and owner_id = p_owner;
  if not found then raise exception 'LAB_NOT_FOUND'; end if;
end $$;

-- Functions default to PUBLIC execute in PostgreSQL; explicitly close every lab RPC.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'lab_resolve_user','lab_list_assignments','lab_get_workspace','lab_create_assignment','lab_begin_run',
      'lab_finish_run','lab_release_run','lab_set_task','lab_save_feedback','lab_export_workspace','lab_delete_assignment'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;


