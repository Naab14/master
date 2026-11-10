-- Allow the newer app sections in app_state. Nothing existing is changed or
-- removed: this only widens which keys a row may have.
--   workforce   people, teams, patterns, competencies, requirements, training
--   attendance  attendance entries and their change log
--   admin       invited users, roles and permissions
--   sketches    Excalidraw boards (reserved)
alter table public.app_state drop constraint if exists app_state_key_check;
alter table public.app_state add constraint app_state_key_check
  check (key in ('boards', 'manageclip', 'vacation', 'workforce', 'attendance', 'admin', 'sketches'));
