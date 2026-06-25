-- Master table for SOP categories/areas
create table if not exists public.sop_categories (
  id uuid default gen_random_uuid() primary key,
  category_name text not null unique,
  description text,
  keywords text[] default '{}',
  created_at timestamptz default now()
);

-- Seed with standard GMP SOP areas
insert into public.sop_categories (category_name, description, keywords) values
  ('Quality Assurance', 'SOPs related to QA systems, audits, CAPA, change control, deviations', '{"quality assurance","QA","audit","CAPA","change control","deviation","complaint","annual product review","APR","stability","vendor qualification","validation master plan"}'),
  ('Quality Control', 'SOPs related to QC testing, sampling, specifications, lab operations', '{"quality control","QC","testing","sampling","analysis","specification","lab","laboratory","OOS","out of specification","reagent","standard","reference standard","stability testing","method validation"}'),
  ('Manufacturing', 'SOPs related to production, batch manufacturing, in-process controls', '{"manufacturing","production","batch","tablet","capsule","liquid","injection","granulation","compression","coating","blending","mixing","in-process","IPC","yield","line clearance","batch record"}'),
  ('Packaging', 'SOPs related to primary and secondary packaging operations', '{"packaging","packing","labeling","label","carton","blister","strip","leaflet","insert","serialization","barcode"}'),
  ('Warehouse & Materials', 'SOPs related to warehouse, storage, material handling, inventory', '{"warehouse","storage","material","inventory","receipt","dispatch","quarantine","cold chain","temperature","humidity","FIFO","FEFO","goods receipt","raw material","finished goods"}'),
  ('Equipment', 'SOPs related to equipment operation, cleaning, calibration, maintenance', '{"equipment","machine","cleaning","calibration","maintenance","preventive maintenance","qualification","IQ","OQ","PQ","operating","operation","SOP for operation"}'),
  ('Facility & Utilities', 'SOPs related to facility management, HVAC, water systems, utilities', '{"facility","HVAC","water","purified water","WFI","clean room","pest control","housekeeping","waste","effluent","utility","compressed air","nitrogen","steam"}'),
  ('Documentation', 'SOPs related to document control, record management, data integrity', '{"document","documentation","record","data integrity","ALCOA","logbook","batch record review","archival","retrieval","SOP management","numbering"}'),
  ('Regulatory Affairs', 'SOPs related to regulatory submissions, compliance, licenses', '{"regulatory","submission","CDSCO","FDA","WHO","license","registration","dossier","CTD","variation","amendment"}'),
  ('Human Resources & Training', 'SOPs related to HR, training, gowning, hygiene', '{"training","HR","human resource","gowning","hygiene","health","medical","personnel","competency","induction","cGMP training"}'),
  ('Validation', 'SOPs related to process validation, cleaning validation, method validation', '{"validation","process validation","cleaning validation","method validation","computer validation","CSV","protocol","report","revalidation"}'),
  ('Engineering', 'SOPs related to engineering, maintenance, utilities management', '{"engineering","maintenance","breakdown","spare","drawing","modification","change part"}'),
  ('Safety & Environment', 'SOPs related to EHS, safety, environment, hazardous materials', '{"safety","environment","EHS","hazardous","fire","emergency","spill","PPE","MSDS","SDS","waste disposal"}'),
  ('General', 'SOPs that do not fit into specific categories', '{"general","miscellaneous","other"}')
on conflict (category_name) do nothing;

-- Add category_id to sop_documents
alter table public.sop_documents add column if not exists category_id uuid references public.sop_categories(id);

-- RLS
alter table public.sop_categories enable row level security;
create policy "Anyone can view categories" on public.sop_categories for select using (true);

-- Create index
create index if not exists idx_sop_documents_category on public.sop_documents(category_id);
