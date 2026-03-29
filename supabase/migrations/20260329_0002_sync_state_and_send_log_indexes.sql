create unique index if not exists sync_state_mail_account_id_folder_id_idx
  on public.sync_state (mail_account_id, folder_id);

create index if not exists send_log_mail_account_id_created_at_idx
  on public.send_log (mail_account_id, created_at desc);

create index if not exists send_log_status_idx
  on public.send_log (status);
