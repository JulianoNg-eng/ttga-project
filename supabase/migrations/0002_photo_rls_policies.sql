-- The /photos page reads and deletes rows directly via PostgREST using the
-- anon key. If row level security is enabled on the drawings table, these
-- policies are required for the grid to load and the delete button to work.
-- (If RLS is disabled they are inert; safe to run either way.)

create policy "anon can read photos"
  on drawings for select
  to anon
  using (type = 'photo');

create policy "anon can delete photos"
  on drawings for delete
  to anon
  using (type = 'photo');
