-- LaunchReady schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/xnzhbgzvnfcqktxosxgf/sql

create table if not exists repos (
  id             text primary key,
  name           text not null,
  full_name      text not null,
  description    text,
  language       text not null,
  stars          integer not null default 0,
  updated_at     timestamptz not null default now(),
  private        boolean not null default false,
  framework      text not null default 'unknown',
  owner          text,
  default_branch text
);

-- Migration: add columns introduced with GitHub OAuth integration
alter table repos add column if not exists owner text;
alter table repos add column if not exists default_branch text;
alter table repos alter column framework set default 'unknown';

create table if not exists scans (
  id         text primary key,
  repo_id    text not null references repos(id) on delete cascade,
  score      integer not null,
  created_at timestamptz not null default now()
);

create table if not exists issues (
  id         text primary key,
  scan_id    text not null references scans(id) on delete cascade,
  category   text not null,
  title      text not null,
  severity   text not null,
  why        text not null,
  time_saved text not null,
  fix_id     text not null
);

-- Enable RLS (rows are readable by anyone with the anon key)
alter table repos  enable row level security;
alter table scans  enable row level security;
alter table issues enable row level security;

create policy "public read repos"  on repos  for select using (true);
create policy "public read scans"  on scans  for select using (true);
create policy "public read issues" on issues for select using (true);

-- fix_requests: tracks async PR-generation jobs
create table if not exists fix_requests (
  id                  text primary key,
  repo_id             text not null references repos(id) on delete cascade,
  scan_id             text not null,
  fixes               text not null,          -- comma-separated fix IDs
  status              text not null default 'pending', -- pending|running|completed|failed|cancelled
  branch_name         text not null,
  pr_number           integer,
  pr_url              text,
  error_message       text,
  est_files_added     integer not null default 0,
  est_files_changed   integer not null default 0,
  est_deps            integer not null default 0,
  credits_cost        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table fix_requests enable row level security;
create policy "public read fix_requests" on fix_requests for select using (true);

-- Add owner_login for credit refund lookup on server restart
alter table fix_requests add column if not exists owner_login text;

-- user_credits: one row per GitHub user, auto-provisioned on first use
create table if not exists user_credits (
  github_login text primary key,
  balance      integer not null default 100,
  updated_at   timestamptz not null default now()
);

alter table user_credits enable row level security;
create policy "public read user_credits" on user_credits for select using (true);

-- credit_transactions: append-only ledger
-- amount is negative for deductions, positive for refunds
create table if not exists credit_transactions (
  id           text primary key,
  github_login text not null,
  amount       integer not null,
  reason       text not null,     -- 'job_deduct' | 'job_refund'
  job_id       text,
  created_at   timestamptz not null default now()
);

alter table credit_transactions enable row level security;
create policy "public read credit_transactions" on credit_transactions for select using (true);

-- ai_test_cache: stores AI-generated test files keyed by scan + fix combination.
-- A cache hit means the user is not charged again on retry.
create table if not exists ai_test_cache (
  id         text primary key,
  scan_id    text not null,
  fix_ids    text not null,   -- sorted comma-separated AI fix IDs
  result     text not null,   -- JSON: Array<{ fixId, path, content }>
  created_at timestamptz not null default now(),
  unique (scan_id, fix_ids)
);

alter table ai_test_cache enable row level security;
create policy "public read ai_test_cache" on ai_test_cache for select using (true);

-- Store AI-generated file list on completed fix_request jobs
alter table fix_requests add column if not exists ai_files text; -- JSON array of { path, content }

-- arch_scans: stores architecture analysis results per repo
create table if not exists arch_scans (
  id           text primary key,
  repo_id      text not null references repos(id) on delete cascade,
  score        integer not null,
  findings     text not null default '[]',  -- JSON: ArchFinding[]
  scanned_files integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table arch_scans enable row level security;
create policy "public read arch_scans" on arch_scans for select using (true);


-- fix_cache: caches complete generated file output per repo+fix combination.
-- Key: (repo_id, fix_ids). TTL enforced in application code (7 days).
-- Covers both template and AI fixes so rescanning the same repo reuses output.
create table if not exists fix_cache (
  id         text primary key default gen_random_uuid()::text,
  repo_id    text not null,
  fix_ids    text not null,   -- sorted comma-separated fix IDs
  framework  text not null default 'unknown',
  files_json text not null,   -- JSON: Array<{ path: string; content: string }>
  created_at timestamptz not null default now(),
  unique (repo_id, fix_ids)
);

alter table fix_cache enable row level security;
create policy "public read fix_cache" on fix_cache for select using (true);
