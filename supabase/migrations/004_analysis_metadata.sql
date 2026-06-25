alter table public.duplicate_analyses add column if not exists name text;
alter table public.duplicate_analyses add column if not exists category_id uuid references public.sop_categories(id);
