-- Drop old table if exists and recreate with richer schema
drop table if exists public.simplification_results;

create table public.simplification_results (
  id uuid default gen_random_uuid() primary key,
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  organization_id uuid not null,
  status text default 'pending' check (status in ('pending','running','completed','failed')),

  -- Overall
  overall_score real,
  overall_summary text,

  -- Layer 1: Linguistic
  linguistic_score real,
  linguistic_issues jsonb default '[]',

  -- Layer 2: Structural
  structural_score real,
  structural_issues jsonb default '[]',

  -- Layer 3: Procedural Clarity
  procedural_score real,
  procedural_issues jsonb default '[]',

  -- Layer 4: Role-Action Alignment
  role_action_score real,
  role_action_issues jsonb default '[]',
  role_action_matrix jsonb default '[]',

  -- Flowchart
  flowchart_mermaid text,

  -- Simplified version suggestion
  simplified_sections jsonb default '[]',

  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_simplification_sop on public.simplification_results(sop_id);
create index if not exists idx_simplification_org on public.simplification_results(organization_id);

alter table public.simplification_results disable row level security;
