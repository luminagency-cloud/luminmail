create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  app_user_id uuid references public.users(id) on delete set null,
  scope text not null,
  level text not null default 'error',
  message text not null,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists app_error_logs_created_at_idx on public.app_error_logs (created_at desc);
create index if not exists app_error_logs_scope_idx on public.app_error_logs (scope);
