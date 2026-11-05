-- One row per model call: which module and feature asked, which model answered,
-- how many tokens it used, what it cost, how long it took and whether it worked.
-- The question and the answer are deliberately not stored, only the numbers.
create table if not exists ai_calls (
  id uuid primary key default gen_random_uuid(),
  module integer not null,
  feature text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  latency_ms integer not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);

-- Row level security is on with no policies at all, so the publishable key can
-- neither read nor write this table. Only server code holding
-- SUPABASE_SECRET_KEY can, which is what lib/supabase/admin.ts is for.
alter table ai_calls enable row level security;

-- Cost reports read the newest calls first.
create index if not exists ai_calls_created_at_idx on ai_calls (created_at desc);
