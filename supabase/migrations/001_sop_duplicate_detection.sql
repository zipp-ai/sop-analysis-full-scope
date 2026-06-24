-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Core SOP documents table for analysis pipeline
create table if not exists public.sop_documents (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null,
  user_id uuid not null references auth.users(id),
  title text not null,
  sop_code text,
  version text,
  effective_date date,
  department text,
  file_url text not null,
  raw_text text,
  status text default 'pending' check (status in ('pending','processing','ready','error')),
  error_message text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Section-level chunks with embeddings
create table if not exists public.sop_sections (
  id uuid default gen_random_uuid() primary key,
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  section_type text not null check (section_type in ('purpose','scope','responsibilities','procedure','references','definitions','other')),
  heading text,
  content text not null,
  embedding vector(1536),
  order_index integer not null,
  created_at timestamptz default now()
);

-- Duplicate analysis runs
create table if not exists public.duplicate_analyses (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null,
  status text default 'pending' check (status in ('pending','running_layer1','running_layer2','running_layer3','completed','failed')),
  total_sops integer default 0,
  total_pairs integer default 0,
  flagged_pairs integer default 0,
  cluster_count integer default 0,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Pairwise comparison results
create table if not exists public.duplicate_pairs (
  id uuid default gen_random_uuid() primary key,
  analysis_id uuid not null references public.duplicate_analyses(id) on delete cascade,
  sop_a_id uuid not null references public.sop_documents(id),
  sop_b_id uuid not null references public.sop_documents(id),
  metadata_score real default 0,
  semantic_score real default 0,
  scope_overlap_score real default 0,
  llm_classification text check (llm_classification in ('full_duplicate','partial_overlap','version_variant','distinct')),
  recommended_action text check (recommended_action in ('retire','merge','split','version_consolidate','review','none')),
  overlapping_sections jsonb default '[]',
  llm_reasoning text,
  user_decision text,
  user_decision_notes text,
  overall_score real generated always as (
    greatest(metadata_score, semantic_score, scope_overlap_score)
  ) stored,
  created_at timestamptz default now()
);

-- Duplicate clusters (groups of related SOPs)
create table if not exists public.duplicate_clusters (
  id uuid default gen_random_uuid() primary key,
  analysis_id uuid not null references public.duplicate_analyses(id) on delete cascade,
  cluster_name text,
  canonical_sop_id uuid references public.sop_documents(id),
  sop_ids uuid[] not null,
  recommended_action text,
  retirement_rationale text,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_sop_documents_org on public.sop_documents(organization_id);
create index if not exists idx_sop_documents_status on public.sop_documents(status);
create index if not exists idx_sop_sections_sop on public.sop_sections(sop_id);
create index if not exists idx_duplicate_pairs_analysis on public.duplicate_pairs(analysis_id);
create index if not exists idx_duplicate_clusters_analysis on public.duplicate_clusters(analysis_id);

-- RLS
alter table public.sop_documents enable row level security;
alter table public.sop_sections enable row level security;
alter table public.duplicate_analyses enable row level security;
alter table public.duplicate_pairs enable row level security;
alter table public.duplicate_clusters enable row level security;

-- RLS policies: authenticated users can access their org's data
create policy "Users can view own org sop_documents" on public.sop_documents
  for select using (auth.uid() = user_id);
create policy "Users can insert own sop_documents" on public.sop_documents
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sop_documents" on public.sop_documents
  for update using (auth.uid() = user_id);
create policy "Users can delete own sop_documents" on public.sop_documents
  for delete using (auth.uid() = user_id);

create policy "Users can view sections of their SOPs" on public.sop_sections
  for select using (exists (
    select 1 from public.sop_documents where id = sop_id and user_id = auth.uid()
  ));
create policy "Service can manage sections" on public.sop_sections
  for all using (true);

create policy "Users can view own org analyses" on public.duplicate_analyses
  for all using (true);
create policy "Users can view own org pairs" on public.duplicate_pairs
  for all using (true);
create policy "Users can view own org clusters" on public.duplicate_clusters
  for all using (true);

-- Helper: cosine similarity search across sections
create or replace function match_sop_sections(
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count int default 20,
  filter_org_id uuid default null
)
returns table (
  id uuid,
  sop_id uuid,
  section_type text,
  heading text,
  content text,
  similarity float
)
language sql stable
as $$
  select s.id, s.sop_id, s.section_type, s.heading, s.content,
         1 - (s.embedding <=> query_embedding) as similarity
  from public.sop_sections s
  join public.sop_documents d on d.id = s.sop_id
  where d.status = 'ready'
    and (filter_org_id is null or d.organization_id = filter_org_id)
    and 1 - (s.embedding <=> query_embedding) > match_threshold
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

-- Helper: compute pairwise section similarity between two SOPs
create or replace function compute_section_similarity(sop_a uuid, sop_b uuid)
returns float
language sql stable
as $$
  select coalesce(avg(1 - (a.embedding <=> b.embedding)), 0)
  from public.sop_sections a
  cross join public.sop_sections b
  where a.sop_id = sop_a and b.sop_id = sop_b
    and a.embedding is not null and b.embedding is not null;
$$;
