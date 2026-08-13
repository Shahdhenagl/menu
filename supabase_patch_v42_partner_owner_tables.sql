-- Partner / Owner tables and automatic partner ledger entries
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table if exists public.partners
  add column if not exists table_names jsonb not null default '[]'::jsonb;

alter table if exists public.orders
  add column if not exists partner_id uuid null references public.partners(id) on delete set null,
  add column if not exists partner_discount_percent numeric(5,2) null,
  add column if not exists partner_subtotal numeric(12,2) null,
  add column if not exists partner_amount_due numeric(12,2) null;

alter table if exists public.partner_transactions
  add column if not exists order_id uuid null references public.orders(id) on delete set null,
  add column if not exists hall text null,
  add column if not exists table_number text null;

create unique index if not exists partner_transactions_order_id_unique
  on public.partner_transactions(order_id)
  where order_id is not null;

create index if not exists orders_partner_id_idx on public.orders(partner_id);
create index if not exists partner_transactions_partner_created_idx
  on public.partner_transactions(partner_id, created_at desc);

-- Partner orders are not cashier collections. They are ledger debits.
create or replace function public.record_partner_order_debit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is not null and coalesce(new.partner_amount_due, 0) > 0 then
    insert into public.partner_transactions
      (partner_id, type, amount, description, order_id, hall, table_number, created_at)
    values
      (
        new.partner_id,
        'debit',
        new.partner_amount_due,
        'Partner/owner POS order #' || left(new.id::text, 8),
        new.id,
        new.hall,
        new.table_number,
        coalesce(new.created_at, now())
      )
    on conflict (order_id) where order_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_partner_order_debit on public.orders;
create trigger trg_record_partner_order_debit
after insert on public.orders
for each row execute function public.record_partner_order_debit();

alter table public.partners enable row level security;
alter table public.partner_transactions enable row level security;

-- Keep compatible with the current app's existing anonymous/session access model.
drop policy if exists partners_select_app on public.partners;
drop policy if exists partners_insert_app on public.partners;
drop policy if exists partners_update_app on public.partners;
drop policy if exists partners_delete_app on public.partners;
drop policy if exists partner_transactions_select_app on public.partner_transactions;
drop policy if exists partner_transactions_insert_app on public.partner_transactions;

create policy partners_select_app on public.partners for select to anon, authenticated using (true);
create policy partners_insert_app on public.partners for insert to anon, authenticated with check (true);
create policy partners_update_app on public.partners for update to anon, authenticated using (true) with check (true);
create policy partners_delete_app on public.partners for delete to anon, authenticated using (true);
create policy partner_transactions_select_app on public.partner_transactions for select to anon, authenticated using (true);
create policy partner_transactions_insert_app on public.partner_transactions for insert to anon, authenticated with check (true);

-- Useful verification query:
-- select id, name, table_names from public.partners order by created_at;
-- select order_id, partner_id, type, amount, hall, table_number from public.partner_transactions order by created_at desc;

notify pgrst, 'reload schema';

-- Note: the trigger needs the orders table to already exist, which it does in this project.
-- If an old database has a different orders.id type, remove the two FK columns above and
-- use the same type as orders.id before rerunning this migration.

-- Backfill is intentionally not automatic: existing historical owner orders must be reviewed
-- before creating ledger debits to avoid double counting.
