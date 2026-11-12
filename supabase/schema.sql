-- =====================================================================
-- Budget Tracker schema (Supabase / PostgreSQL)
-- Run once in the Supabase SQL editor of a fresh project.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- accounts: one row per bank account / card the user imports from
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  type       text not null check (type in ('savings', 'credit_card')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------
-- transactions
--   amount is always positive; `type` carries the direction.
--   dedupe_key = SHA-256 computed client-side at import (see src/lib/import).
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id  uuid references public.accounts (id) on delete set null,
  date        date not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  type        text not null check (type in ('income', 'expense')),
  category    text not null default 'Uncategorized' check (char_length(category) between 1 and 60),
  description text not null default '',
  merchant    text,
  notes       text check (notes is null or char_length(notes) <= 2000),
  balance     numeric(14, 2),               -- running statement balance (savings only)
  dedupe_key  text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists transactions_user_dedupe_key_uidx
  on public.transactions (user_id, dedupe_key);
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);
create index if not exists transactions_user_type_category_idx
  on public.transactions (user_id, type, category);

-- ---------------------------------------------------------------------
-- budgets: monthly limit per category
-- ---------------------------------------------------------------------
create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category      text not null check (char_length(category) between 1 and 60),
  monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
  unique (user_id, category)
);

-- ---------------------------------------------------------------------
-- settings: one row per user (single overall monthly limit)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  overall_monthly_limit numeric(12, 2) check (overall_monthly_limit is null or overall_monthly_limit >= 0),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- category_rules: case-insensitive keyword -> category, applied at import.
--   Lower priority value wins when several keywords match.
-- ---------------------------------------------------------------------
create table if not exists public.category_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  keyword    text not null check (char_length(keyword) between 1 and 100),
  category   text not null check (char_length(category) between 1 and 60),
  priority   int not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists category_rules_user_keyword_uidx
  on public.category_rules (user_id, lower(keyword));

-- =====================================================================
-- Row Level Security: every table is private to its owner
-- =====================================================================
alter table public.accounts       enable row level security;
alter table public.transactions   enable row level security;
alter table public.budgets        enable row level security;
alter table public.settings       enable row level security;
alter table public.category_rules enable row level security;

drop policy if exists "accounts are private" on public.accounts;
create policy "accounts are private" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "transactions are private" on public.transactions;
create policy "transactions are private" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "budgets are private" on public.budgets;
create policy "budgets are private" on public.budgets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "settings are private" on public.settings;
create policy "settings are private" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "category rules are private" on public.category_rules;
create policy "category rules are private" on public.category_rules
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A transaction may only reference an account owned by the same user.
create or replace function public.check_transaction_account_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id
  ) then
    raise exception 'account % does not belong to this user', new.account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_account_owner on public.transactions;
create trigger transactions_account_owner
  before insert or update of account_id, user_id on public.transactions
  for each row execute function public.check_transaction_account_owner();

-- =====================================================================
-- Default data for new users (settings row + starter category rules)
-- =====================================================================
create or replace function public.seed_user_defaults(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (p_user)
  on conflict (user_id) do nothing;

  insert into public.category_rules (user_id, keyword, category, priority)
  select p_user, r.keyword, r.category, r.priority
  from (values
    ('GRAB RIDES',      'Transport',     10),
    ('RAPID RAIL',      'Transport',     10),
    ('TNG-EWALLET',     'E-Wallet',      20),
    ('FOODPANDA',       'Food',          10),
    ('GRABFOOD',        'Food',          10),
    ('MCDONALDS',       'Food',          10),
    ('SUBWAY',          'Food',          20),
    ('MAMAK',           'Food',          20),
    ('99 SPEEDMART',    'Groceries',     10),
    ('KK SUPER MART',   'Groceries',     10),
    ('FAMILYMART',      'Groceries',     10),
    ('AEON',            'Groceries',     20),
    ('VILLAGE GROCER',  'Groceries',     10),
    ('BUTCHER',         'Groceries',     20),
    ('MR DIY',          'Shopping',      10),
    ('UMOBILE',         'Bills',         10),
    ('PREPAID RELOAD',  'Bills',         20),
    ('APPLE.COM',       'Subscriptions', 10),
    ('GOOGLE',          'Subscriptions', 30),
    ('HIBAH',           'Profit',        5),
    ('PROFIT',          'Profit',        5)
  ) as r(keyword, category, priority)
  on conflict (user_id, lower(keyword)) do nothing;
end;
$$;

-- Only the signup trigger (running as the table owner) may call it.
revoke execute on function public.seed_user_defaults(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that signed up before this script was run.
select public.seed_user_defaults(u.id) from auth.users u;

-- =====================================================================
-- Dashboard RPCs (security invoker => RLS still applies)
-- =====================================================================

-- All-time income/expenses plus this calendar month's expenses
-- (month boundaries in Asia/Kuala_Lumpur).
create or replace function public.dashboard_totals()
returns table (total_income numeric, total_expenses numeric, month_expenses numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    coalesce(sum(t.amount) filter (
      where t.type = 'expense'
        and t.date >= date_trunc('month', (now() at time zone 'Asia/Kuala_Lumpur'))::date
    ), 0)
  from public.transactions t
  where t.user_id = (select auth.uid());
$$;

-- Expense total per day for the last `days` days, zero-filled.
create or replace function public.daily_spending(days int default 30)
returns table (day date, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (now() at time zone 'Asia/Kuala_Lumpur')::date as today,
           least(greatest(coalesce(days, 30), 1), 366) as n
  )
  select d.day::date, coalesce(sum(t.amount), 0) as total
  from bounds b
  cross join lateral generate_series(b.today - (b.n - 1), b.today, interval '1 day') as d(day)
  left join public.transactions t
    on t.date = d.day::date
   and t.type = 'expense'
   and t.user_id = (select auth.uid())
  group by d.day
  order by d.day;
$$;

grant execute on function public.dashboard_totals() to authenticated;
grant execute on function public.daily_spending(int) to authenticated;
