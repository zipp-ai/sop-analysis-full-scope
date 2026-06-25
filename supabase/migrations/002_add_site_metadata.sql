-- Add site metadata to sop_documents
alter table public.sop_documents add column if not exists site text default 'Global';
