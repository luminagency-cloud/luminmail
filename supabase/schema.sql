create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  imap_host text not null,
  imap_port integer not null default 993,
  smtp_host text not null,
  smtp_port integer not null default 587,
  encrypted_secret bytea,
  secret_iv bytea,
  provider text default 'imap-smtp',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists mail_accounts_owner_user_id_idx on public.mail_accounts (owner_user_id);
create unique index if not exists mail_accounts_owner_user_id_email_idx on public.mail_accounts (owner_user_id, email);

drop trigger if exists mail_accounts_set_updated_at on public.mail_accounts;
create trigger mail_accounts_set_updated_at
before update on public.mail_accounts
for each row execute function public.set_updated_at();

create table if not exists public.mail_folders (
  id uuid primary key default gen_random_uuid(),
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  provider_folder_id text,
  name text not null,
  role text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  subject text,
  thread_key text not null,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists threads_mail_account_id_thread_key_idx on public.threads (mail_account_id, thread_key);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  folder_id uuid references public.mail_folders(id) on delete set null,
  provider_message_id text not null,
  message_id_header text,
  in_reply_to text,
  reference_headers text[],
  from_name text,
  from_email text,
  to_emails text[] not null default '{}',
  subject text not null,
  preview text,
  body_text text,
  body_html text,
  received_at timestamptz not null,
  is_unread boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists messages_mail_account_id_provider_message_id_idx
  on public.messages (mail_account_id, provider_message_id);

create table if not exists public.sync_state (
  id uuid primary key default gen_random_uuid(),
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  folder_id uuid references public.mail_folders(id) on delete cascade,
  uid_validity bigint,
  last_seen_uid bigint,
  last_synced_at timestamptz,
  status text not null default 'idle',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists sync_state_set_updated_at on public.sync_state;
create trigger sync_state_set_updated_at
before update on public.sync_state
for each row execute function public.set_updated_at();

create table if not exists public.send_log (
  id uuid primary key default gen_random_uuid(),
  mail_account_id uuid not null references public.mail_accounts(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  to_emails text[] not null default '{}',
  subject text not null,
  body_text text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);
