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

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (auth_user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.users.display_name),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_auth_user_created();

insert into public.users (auth_user_id, email, display_name)
select
  au.id,
  coalesce(au.email, ''),
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name', split_part(coalesce(au.email, ''), '@', 1))
from auth.users au
on conflict (auth_user_id) do update
set
  email = excluded.email,
  display_name = coalesce(excluded.display_name, public.users.display_name),
  updated_at = timezone('utc', now());

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
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

alter table public.mail_accounts add column if not exists user_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mail_accounts'
      and column_name = 'owner_user_id'
  ) then
    execute $migrate$
      update public.mail_accounts ma
      set user_id = u.id
      from public.users u
      where ma.user_id is null
        and ma.owner_user_id = u.auth_user_id
    $migrate$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mail_accounts_user_id_fkey'
  ) then
    alter table public.mail_accounts
      add constraint mail_accounts_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from public.mail_accounts where user_id is null) then
    raise exception 'mail_accounts contains rows without a mapped public.users owner. Backfill public.users before rerunning schema.';
  end if;
end;
$$;

alter table public.mail_accounts alter column user_id set not null;

drop index if exists mail_accounts_owner_user_id_idx;
drop index if exists mail_accounts_owner_user_id_email_idx;
create index if not exists mail_accounts_user_id_idx on public.mail_accounts (user_id);
create unique index if not exists mail_accounts_user_id_email_idx on public.mail_accounts (user_id, email);

alter table public.mail_accounts drop column if exists owner_user_id;

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
