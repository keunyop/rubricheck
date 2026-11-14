-- Keep the original broad values for existing events and rollback compatibility.
-- New values are fixed categories derived from server-owned error codes; never
-- persist an arbitrary message, uploaded text, or user-provided string.
alter table public.growth_events drop constraint growth_events_failure_check;
alter table public.growth_events add constraint growth_events_failure_check
  check (failure in (
    'server', 'access', 'validation', 'network',
    'validation_input', 'validation_file', 'validation_rubric',
    'validation_pending', 'validation_other'
  ));
