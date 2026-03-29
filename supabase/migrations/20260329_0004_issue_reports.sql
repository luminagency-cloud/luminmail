create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  account_id uuid references public.mail_accounts(id) on delete set null,
  reporter_email text not null,
  page_route text not null,
  description text not null,
  screenshot_name text,
  screenshot_content_type text,
  screenshot_bytes bytea,
  screenshot_size integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists issue_reports_user_id_created_at_idx
  on public.issue_reports (user_id, created_at desc);
