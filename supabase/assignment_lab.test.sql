-- Run only in a disposable/local PostgreSQL database after assignment_lab.sql.
begin;
do $$
declare
  u uuid := lab_resolve_user(repeat('a',64)); other_u uuid := lab_resolve_user(repeat('b',64));
  a uuid := gen_random_uuid(); other_a uuid := gen_random_uuid(); token uuid := gen_random_uuid();
  token2 uuid := gen_random_uuid(); r uuid; r2 uuid; rv uuid; task uuid := gen_random_uuid();
  conditions jsonb; workspace jsonb; result jsonb;
begin
  assert lab_resolve_user(repeat('a',64)) = u, 'stable user identity';
  perform lab_create_assignment(u, a, 'Essay', 'Evidence and argument', 'V1 text', 'standard', false);
  assert lab_create_assignment(u, a, 'Essay', 'Evidence and argument', 'V1 text', 'standard', false) = a, 'idempotent create';
  assert jsonb_array_length(lab_list_assignments(u)) = 1, 'one assignment';
  assert jsonb_array_length(lab_list_assignments(other_u)) = 0, 'other owner list empty';
  begin
    perform lab_create_assignment(u, gen_random_uuid(), 'Other', 'Rubric', 'Draft', 'standard', false);
    raise exception 'expected assignment limit';
  exception when raise_exception then if sqlerrm <> 'LAB_ASSIGNMENT_LIMIT' then raise; end if; end;
  perform lab_create_assignment(other_u, other_a, 'Other owner', 'Rubric', 'Draft', 'standard', false);
  begin
    perform lab_get_workspace(other_u, a); raise exception 'expected owner denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  begin
    perform lab_export_workspace(other_u, a); raise exception 'expected export denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  begin
    perform lab_delete_assignment(other_u, a); raise exception 'expected delete denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  begin
    perform lab_begin_run(other_u, a, 'hash', token, true); raise exception 'expected evaluate denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  workspace := lab_get_workspace(u,a); rv := (workspace->'rubric'->>'id')::uuid;
  conditions := jsonb_build_object('rubricVersionId', rv, 'mode','standard','model','model-test','structureModel','structure-test');
  result := lab_begin_run(u,a,'hash1',token,false);
  assert (result->>'reused')::boolean = false, 'reserve new draft';
  begin
    perform lab_begin_run(u,a,'hash2',token2,false); raise exception 'expected concurrent lock';
  exception when raise_exception then if sqlerrm <> 'LAB_PENDING' then raise; end if; end;
  perform lab_release_run(other_u,a,token);
  perform lab_release_run(u,a,token2);
  assert (select lease_token from lab_assignments where id=a) = token, 'foreign owner/token cannot unlock';
  begin
    perform lab_finish_run(u,a,token2,'hash1','V1 text',conditions,'{}','{}','[]'); raise exception 'expected stale token';
  exception when raise_exception then if sqlerrm <> 'LAB_STALE' then raise; end if; end;
  -- A bad task must roll back the entire run (no partially stored V1).
  begin
    perform lab_finish_run(u,a,token,'hash1','V1 text',conditions,'{}','{}','[{"task_key":"bad-id"}]');
    raise exception 'expected task parse failure';
  exception when invalid_text_representation then null; end;
  assert (select count(*) from lab_evaluation_runs where assignment_id=a) = 0, 'atomic save';
  r := lab_finish_run(u,a,token,'hash1','V1 text',conditions,'{}','{"overall_range":[40,60]}',
    jsonb_build_array(jsonb_build_object('task_key',task,'criterion_index',0,'title','Add evidence','status','new')));
  assert lab_finish_run(u,a,token,'hash1','V1 text',conditions,'{}','{}','[]') = r, 'idempotent finish after response loss';
  assert (lab_begin_run(u,a,'hash1',token2,false)->>'reused')::boolean, 'reuse does not make new version';
  perform lab_set_task(u,a,r,task,true);
  workspace := lab_get_workspace(u,a);
  assert (workspace->'runs'->0->'tasks'->0->>'user_done')::boolean, 'checkbox persisted';
  assert workspace->'runs'->0->'tasks'->0->>'status' = 'new', 'checkbox cannot mark AI issue resolved';
  begin
    perform lab_set_task(other_u,a,r,task,false); raise exception 'expected task owner denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  begin
    perform lab_save_feedback(u,a,r,true); raise exception 'expected V1 feedback denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  perform lab_begin_run(u,a,'hash2',token2,false);
  r2 := lab_finish_run(u,a,token2,'hash2','V2 revised text',conditions,'{}','{"overall_range":[30,50]}','[]');
  assert (lab_get_workspace(u,a)->'runs'->1->'result'->'overall_range'->>0)::int = 30, 'lower scores preserved';
  assert (lab_get_workspace(u,a)->'runs'->0->>'draft_text') = 'V1 text', 'original draft immutable';
  perform lab_save_feedback(u,a,r2,true); perform lab_save_feedback(u,a,r2,false);
  assert (select count(*) from lab_events where run_id=r2 and event_name='revision_feedback') = 1, 'feedback idempotent';
  begin
    perform lab_save_feedback(other_u,a,r2,true); raise exception 'expected feedback owner denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
  begin
    perform lab_begin_run(u,a,'hash3',token,false); raise exception 'expected version limit';
  exception when raise_exception then if sqlerrm <> 'LAB_VERSION_LIMIT' then raise; end if; end;
  assert (lab_begin_run(u,a,'hash1',token,false)->>'reused')::boolean, 'reuse beyond quota';
  perform lab_begin_run(u,a,'hash3',token,true);
  perform lab_release_run(u,a,token);
  perform lab_create_assignment(u, gen_random_uuid(),'Pro extra','Rubric','Draft','standard',true);
  assert jsonb_array_length(lab_list_assignments(u)) = 2, 'Pro multiple assignments';
  workspace := lab_export_workspace(u,a);
  assert jsonb_array_length(workspace->'runs') = 2, 'export all versions without plan gate';
  assert jsonb_array_length(workspace->'events') > 0, 'export includes feedback';
  perform lab_delete_assignment(u,a);
  assert not exists (select 1 from lab_rubric_versions where assignment_id=a), 'cascade rubric deletion';
  assert not exists (select 1 from lab_evaluation_runs where assignment_id=a), 'cascade run deletion';
  assert not exists (select 1 from lab_revision_tasks where run_id=r), 'cascade task deletion';
  assert not exists (select 1 from lab_events where assignment_id=a), 'cascade analytics deletion';
  assert exists (select 1 from lab_assignments where id=other_a), 'other owner preserved';
  begin
    perform lab_finish_run(u,a,token,'late','Late draft',conditions,'{}','{}','[]'); raise exception 'expected deleted assignment denial';
  exception when raise_exception then if sqlerrm <> 'LAB_NOT_FOUND' then raise; end if; end;
end $$;
do $$
declare f record; t record;
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lab_%' loop
    assert not has_function_privilege('anon',f.oid,'EXECUTE'), 'anon cannot execute ' || f.proname;
    assert not has_function_privilege('authenticated',f.oid,'EXECUTE'), 'authenticated cannot execute ' || f.proname;
    assert has_function_privilege('service_role',f.oid,'EXECUTE'), 'service role can execute ' || f.proname;
  end loop;
  for t in select oid, relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'lab_%' loop
    assert t.relrowsecurity, 'RLS enabled';
    assert not has_table_privilege('anon',t.oid,'SELECT'), 'anon cannot read table';
    assert not has_table_privilege('authenticated',t.oid,'SELECT'), 'authenticated cannot read table';
  end loop;
end $$;
rollback;
select 'PASS: lab identity, ownership, free/pro quotas, idempotency, stale leases, atomic save, comparison, export, cascade deletion and RPC/RLS permissions' as result;

