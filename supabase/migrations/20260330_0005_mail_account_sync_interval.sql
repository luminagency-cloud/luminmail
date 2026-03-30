alter table public.mail_accounts
add column if not exists sync_interval_minutes integer not null default 15;

update public.mail_accounts
set sync_interval_minutes = 15
where sync_interval_minutes is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mail_accounts_sync_interval_minutes_check'
  ) then
    alter table public.mail_accounts
    add constraint mail_accounts_sync_interval_minutes_check
    check (sync_interval_minutes in (5, 15, 30, 60));
  end if;
end $$;
