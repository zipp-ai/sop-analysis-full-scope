-- Fix RLS: allow authenticated users to see all SOPs in their org
-- and all analysis data (analyses/pairs are not user-scoped)

-- Drop restrictive sop_documents policies
drop policy if exists "Users can view own org sop_documents" on public.sop_documents;
drop policy if exists "Users can insert own sop_documents" on public.sop_documents;
drop policy if exists "Users can update own sop_documents" on public.sop_documents;
drop policy if exists "Users can delete own sop_documents" on public.sop_documents;

-- Replace with permissive policies for authenticated users
create policy "Authenticated users can view sop_documents" on public.sop_documents
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert sop_documents" on public.sop_documents
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update sop_documents" on public.sop_documents
  for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete sop_documents" on public.sop_documents
  for delete using (auth.role() = 'authenticated');

-- Fix sop_sections - allow authenticated read
drop policy if exists "Users can view sections of their SOPs" on public.sop_sections;
create policy "Authenticated users can view sop_sections" on public.sop_sections
  for select using (auth.role() = 'authenticated');
