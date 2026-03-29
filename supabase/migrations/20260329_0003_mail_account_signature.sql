alter table public.mail_accounts
  add column if not exists signature text not null default '';
