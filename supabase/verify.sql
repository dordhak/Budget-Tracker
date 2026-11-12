-- =====================================================================
-- Schema verification. Paste into the Supabase SQL editor AFTER schema.sql.
-- Everything runs in one transaction that is ROLLED BACK at the end,
-- so no test users or rows are left behind.
-- Each check raises an exception on failure; success prints NOTICEs.
-- =====================================================================
begin;

-- Two throwaway users (the signup trigger seeds their defaults).
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'verify-a@example.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'verify-b@example.test', 'authenticated', 'authenticated');

-- ---- Act as user A ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.category_rules;
  if n = 0 then raise exception 'FAIL: default category rules were not seeded'; end if;
  select count(*) into n from public.settings;
  if n <> 1 then raise exception 'FAIL: expected exactly 1 settings row, got %', n; end if;
  raise notice 'PASS: defaults seeded for new user (% rules)', (select count(*) from public.category_rules);

  -- RPCs return zeros on an empty account
  if (select total_income + total_expenses + month_expenses from public.dashboard_totals()) <> 0 then
    raise exception 'FAIL: dashboard_totals not zero for empty user';
  end if;
  if (select count(*) from public.daily_spending(30)) <> 30 then
    raise exception 'FAIL: daily_spending(30) did not return 30 rows';
  end if;
  raise notice 'PASS: RPCs return zeros / 30 zero-filled days';

  insert into public.transactions (date, amount, type, description, dedupe_key)
  values (current_date, 10.00, 'expense', 'A coffee', 'key-1');

  begin
    insert into public.transactions (date, amount, type, description, dedupe_key)
    values (current_date, 10.00, 'expense', 'A coffee', 'key-1');
    raise exception 'FAIL: duplicate dedupe_key was accepted';
  exception when unique_violation then
    raise notice 'PASS: duplicate (user_id, dedupe_key) rejected';
  end;
end $$;

-- ---- Act as user B ----
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.transactions;
  if n <> 0 then raise exception 'FAIL: user B can see % of user A''s transactions', n; end if;

  update public.transactions set category = 'Hacked' where dedupe_key = 'key-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B updated user A''s rows'; end if;

  begin
    insert into public.transactions (user_id, date, amount, type, dedupe_key)
    values ('00000000-0000-0000-0000-00000000000a', current_date, 1, 'expense', 'evil');
    raise exception 'FAIL: user B inserted a row owned by user A';
  exception when insufficient_privilege then
    raise notice 'PASS: RLS blocks inserting rows for another user';
  end;

  -- The same dedupe_key is fine for a different user.
  insert into public.transactions (date, amount, type, description, dedupe_key)
  values (current_date, 10.00, 'expense', 'B coffee', 'key-1');
  raise notice 'PASS: cross-user isolation holds; dedupe is per user';
end $$;

reset role;
rollback;
