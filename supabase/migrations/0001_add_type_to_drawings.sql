-- Add a type column to distinguish drawings from photos.
-- Existing rows are backfilled with 'drawing' via the default.
alter table drawings
  add column if not exists type text not null default 'drawing';

-- Speeds up the type = 'drawing' / type = 'photo' filters used everywhere.
create index if not exists drawings_type_created_at_idx
  on drawings (type, created_at);
