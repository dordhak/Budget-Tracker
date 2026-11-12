-- =====================================================================
-- Migration 002: manual / receipt entries, statement matching, receipt images.
-- Run in the Supabase SQL editor AFTER schema.sql. Safe to re-run.
-- Existing tables and data are not modified.
-- =====================================================================

-- ---------------------------------------------------------------------
-- entries: what you record during the month (receipt, e-receipt or manual).
--   transaction_id links an entry to the statement row it was matched with,
--   so the same purchase is never counted twice.
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date           date not null,
  amount         numeric(12, 2) not null check (amount > 0),
  type           text not null check (type in ('income', 'expense')),
  category       text not null default 'Uncategorized' check (char_length(category) between 1 and 60),
  merchant       text check (merchant is null or char_length(merchant) <= 120),
  description    text not null default '' check (char_length(description) <= 500),
  notes          text check (notes is null or char_length(notes) <= 2000),
  payment_method text not null default 'bank' check (payment_method in ('bank', 'cash')),
  source         text not null default 'manual' check (source in ('manual', 'receipt_image', 'receipt_pdf')),
  -- Storage object path inside the private "receipts" bucket: "<user_id>/<file>".
  receipt_path   text check (receipt_path is null or char_length(receipt_path) <= 300),
  transaction_id uuid unique references public.transactions (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Cash never appears on a bank statement, so it can't be matched.
  constraint entries_cash_unmatched check (payment_method = 'bank' or transaction_id is null)
);

create index if not exists entries_user_date_idx on public.entries (user_id, date desc);
create index if not exists entries_user_unmatched_idx
  on public.entries (user_id, date) where transaction_id is null and payment_method = 'bank';

alter table public.entries enable row level security;

drop policy if exists "entries are private" on public.entries;
create policy "entries are private" on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Foreign keys ignore RLS, so check explicitly that a linked statement row is
-- the same user's and the same kind of transaction.
create or replace function public.check_entry_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare t record;
begin
  new.updated_at := now();
  if new.transaction_id is null then
    return new;
  end if;
  select user_id, type into t from public.transactions where id = new.transaction_id;
  if not found or t.user_id <> new.user_id then
    raise exception 'statement transaction % does not belong to this user', new.transaction_id;
  end if;
  if t.type <> new.type then
    raise exception 'cannot link a % entry to a % statement row', new.type, t.type;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_check_link on public.entries;
create trigger entries_check_link
  before insert or update on public.entries
  for each row execute function public.check_entry_link();

-- ---------------------------------------------------------------------
-- Private storage bucket for receipt images / PDFs (10 MB each).
-- Objects live under "<user_id>/..." and only their owner can touch them.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts: owner can read" on storage.objects;
create policy "receipts: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts: owner can upload" on storage.objects;
create policy "receipts: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts: owner can update" on storage.objects;
create policy "receipts: owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts: owner can delete" on storage.objects;
create policy "receipts: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
