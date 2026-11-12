-- =====================================================================
-- Verification for migration 002. Run AFTER 002_entries.sql.
-- Everything runs in one transaction that is ROLLED BACK at the end.
-- Each check raises an exception on failure; success prints NOTICEs.
-- =====================================================================
begin;

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000a2', 'verify2-a@example.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000b2', 'verify2-b@example.test', 'authenticated', 'authenticated');

-- ---- user B owns one statement row ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
insert into public.transactions (id, date, amount, type, description, dedupe_key)
values ('00000000-0000-0000-0000-00000000b001', current_date, 9.00, 'expense', 'B grab', 'v2-b-1');

-- ---- user A ----
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

do $$
begin
  insert into public.transactions (id, date, amount, type, description, dedupe_key)
  values ('00000000-0000-0000-0000-00000000a001', current_date, 3.50, 'expense', 'A KK mart', 'v2-a-1'),
         ('00000000-0000-0000-0000-00000000a002', current_date, 500.00, 'income', 'A salary', 'v2-a-2');

  insert into public.entries (id, date, amount, type, merchant, transaction_id)
  values ('00000000-0000-0000-0000-00000000e001', current_date, 3.50, 'expense', 'KK SUPER MART',
          '00000000-0000-0000-0000-00000000a001');
  raise notice 'PASS: entry linked to own statement row';

  begin
    insert into public.entries (date, amount, type, transaction_id)
    values (current_date, 3.50, 'expense', '00000000-0000-0000-0000-00000000a001');
    raise exception 'FAIL: one statement row linked to two entries';
  exception when unique_violation then
    raise notice 'PASS: a statement row can match only one entry';
  end;

  begin
    insert into public.entries (date, amount, type, payment_method, transaction_id)
    values (current_date, 500.00, 'income', 'cash', '00000000-0000-0000-0000-00000000a002');
    raise exception 'FAIL: cash entry was linked to a statement row';
  exception when check_violation then
    raise notice 'PASS: cash entries cannot be matched';
  end;

  begin
    insert into public.entries (date, amount, type, transaction_id)
    values (current_date, 500.00, 'expense', '00000000-0000-0000-0000-00000000a002');
    raise exception 'FAIL: expense entry linked to an income row';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: entry and statement row types must agree';
  end;

  begin
    insert into public.entries (date, amount, type, transaction_id)
    values (current_date, 9.00, 'expense', '00000000-0000-0000-0000-00000000b001');
    raise exception 'FAIL: linked to another user''s statement row';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'PASS: cannot link to another user''s statement row';
  end;

  -- Deleting the statement row unlinks the entry instead of deleting it.
  delete from public.transactions where id = '00000000-0000-0000-0000-00000000a001';
  if (select transaction_id from public.entries where id = '00000000-0000-0000-0000-00000000e001') is not null then
    raise exception 'FAIL: entry still linked after its statement row was deleted';
  end if;
  raise notice 'PASS: deleting a statement row keeps the entry, unlinked';
end $$;

-- ---- user B cannot see A's entries ----
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.entries) <> 0 then
    raise exception 'FAIL: user B can see user A''s entries';
  end if;
  raise notice 'PASS: entries are private';
end $$;

-- ---- storage bucket ----
reset role;
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'receipts' and public = false) then
    raise exception 'FAIL: private receipts bucket missing';
  end if;
  raise notice 'PASS: private receipts bucket exists';
end $$;

rollback;
